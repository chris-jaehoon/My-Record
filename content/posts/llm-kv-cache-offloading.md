---
title: "LLM 서빙할 때 GPU만 늘리면 될까? 모델부터 메모리까지"
description: "2026년 11월 기준 vLLM 서빙 경험을 바탕으로 Dense와 MoE 모델 선택, Prefill과 Decode, KV Cache, GPU와 RAM 증설 및 동시 요청 처리 기준을 정리했습니다."
date: "2026-11-28"
category: "AI, SW 아키텍처"
tags: ["LLM", "KV Cache", "vLLM", "GPU"]
---

요즘 LLM을 직접 서빙하면서 Weight 양자화와 KV Cache Offloading을 같이 쓰고 있어요. GPU 메모리가 부족하면 일반 RAM을 더 붙여서 해결하면 되지 않을까 싶은데, 막상 따져보니 RAM을 늘리는 것과 VRAM을 늘리는 건 기대할 수 있는 효과가 좀 다르더라고요.

저는 vLLM으로 모델을 띄워 RAG와 Multi-Agent 시스템에서 쓰고 있어요. 에이전트 하나가 여러 번 모델을 호출하다 보니 사용자 수만으로 서버 부하를 계산하기도 어렵습니다. 현재 Weight와 KV Cache 양자화, Host RAM을 이용한 KV Cache Offloading을 사용하고 있습니다.

특히 여러 사람이 동시에 모델을 쓰는 경우와 한 사람이 아주 긴 문서를 넣는 경우를 구분해서 봐야 합니다. 모델을 고르는 단계부터 이 차이를 생각해야 하더라고요.

## Dense와 MoE, 파라미터 수만 보고 고르면 안 된다

Dense 모델은 일반적으로 각 토큰을 처리할 때 모든 레이어의 해당 Weight를 사용합니다. MoE(Mixture of Experts)는 일부 FFN을 여러 Expert로 나누고 Router가 토큰마다 사용할 Expert를 고르는 구조예요.

예를 들어 전체 100B 중 토큰당 10B가 활성화되는 가상의 MoE 모델이라면, 10B Dense 모델과 비슷한 크기의 연산을 한다고 단순하게 생각하기 쉽습니다. 하지만 전체 Weight를 GPU에 상주시킨다면 100B에 해당하는 저장 공간이 필요해요. Attention과 공유 레이어의 연산, Expert 선택 및 통신 비용도 따로 고려해야 합니다.

| 비교 항목 | Dense | MoE |
| --- | --- | --- |
| Weight 메모리 | 전체 파라미터 기준 | 전체 Expert 포함 파라미터 기준 |
| 토큰당 연산 | 대부분의 Weight 사용 | 선택된 Expert와 공유 레이어 사용 |
| 여러 GPU 사용 | TP, PP 등 | TP, PP, EP 등 |
| 추가 병목 | GPU 간 통신 | Expert 쏠림과 토큰 전송 |

MoE라고 KV Cache까지 활성 파라미터 비율만큼 작아지는 건 아닙니다. 캐시는 Attention 구조에 따라 따로 계산해야 해요. Expert Parallelism(EP)으로 Expert를 여러 GPU에 나눌 수도 있지만 GPU 간 통신 속도와 부하 균형이 중요합니다. 이 부분은 제가 직접 EP를 운영해 얻은 실측 결과가 아니라 모델 선택 시 고려할 구조적인 차이입니다.

## Prefill과 Decode를 따로 봐야 하는 이유

긴 문서를 처음 넣으면 입력 토큰들을 처리해서 KV Cache를 만드는 Prefill 단계가 먼저 진행됩니다. 이후 답변을 한 토큰씩 만드는 Decode 단계가 이어져요. 보통 긴 입력의 Prefill은 연산량 부담이 커지고, 작은 배치의 Decode는 Weight와 캐시를 읽는 메모리 대역폭이 병목이 되기 쉽습니다. 실제 병목은 배치와 모델에 따라 달라지고요.

RAG나 코드 분석은 입력이 길어지기 쉽고, 여러 Agent가 동시에 호출하면 Prefill과 Decode가 섞입니다. vLLM의 Continuous Batching은 진행 중인 요청 사이에 새 요청을 배치하고, Chunked Prefill은 긴 입력을 나눠 처리해 Decode와 자원을 공유하도록 돕습니다. 무작정 배치를 키우면 전체 처리량은 좋아져도 개별 응답은 느려질 수 있어요.

## KV Cache는 대체 뭘 저장하는 걸까?

LLM이 답변을 한 토큰씩 생성할 때 앞에서 처리한 토큰의 Key와 Value를 저장해 두는 게 KV Cache예요. 다음 토큰을 생성할 때 앞의 Key와 Value를 매번 다시 계산하지 않아도 됩니다.

문제는 입력과 출력 토큰이 늘어날수록 이 캐시도 커진다는 거예요. 모델의 Weight는 같은 모델을 띄워 놓으면 대체로 일정한데, KV Cache는 요청마다 필요한 양이 달라집니다.

예를 들어 32개 레이어, KV Head 8개, Head Dimension 128인 모델에서 FP16으로 캐시를 저장한다고 가정해 볼게요.

토큰당 KV Cache = 2(K와 V) × 32 × 8 × 128 × 2 bytes = 128 KiB

| 전체 토큰 수 | KV Cache 크기 |
| --- | ---: |
| 8,192 | 1 GiB |
| 32,768 | 4 GiB |
| 131,072 | 16 GiB |

실제 서빙 중인 모델의 측정값은 아니고, 위 조건으로 직접 계산한 예시입니다. Weight나 CUDA 작업 공간, 메모리 할당 오버헤드는 빠져 있어요. 같은 32K 요청이 네 개라면 공유되는 Prefix가 없다는 가정에서 캐시만 16 GiB가 필요합니다.

## Host RAM에 캐시를 저장하면 되는 거 아닌가?

GPU에서 당장 쓰지 않는 캐시를 Host RAM으로 옮겨 두고, 다시 필요할 때 불러오는 방식이 있습니다. KV Cache Offloading이라고 해요.

여기서 중요한 건 엔진이 어떤 방식으로 오프로딩하느냐입니다. 비활성 요청이나 재사용할 Prefix를 CPU에 보관하는 방식이라면 동시 요청 처리나 캐시 재사용에는 도움이 되지만, 한 요청의 최대 길이가 그대로 늘어나는 건 아니에요. 활성 KV까지 CPU로 넘겨 처리하는 구현이라면 메모리 제약을 더 완화할 수 있지만 전송 비용이 생깁니다.

GPU가 계산하는 동안 CPU와 GPU가 PCIe로 데이터를 주고받아야 하니까요. 전송과 계산을 겹칠 수 있는 정도에 따라 실제 tok/s 손실도 달라집니다.

| 방법 | 주로 기대하는 효과 |
| --- | --- |
| GPU VRAM 증설 | 활성 KV Cache와 Weight를 더 많이 GPU에 유지 |
| Host RAM 증설 | 엔진이 지원하는 CPU 캐시 보관 공간 확대 |
| Weight 양자화 | Weight가 차지하던 VRAM 확보 |
| KV Cache 양자화 | 토큰당 캐시 메모리 감소 |
| Prefix Caching | 동일한 앞부분의 계산과 캐시 재사용 |

## 그래서 컨텍스트를 더 길게 쓰려면?

우선 모델이 지원하는 길이와 서빙 엔진의 최대 길이 설정을 확인해야 해요. 메모리가 남는다고 모델의 학습 컨텍스트나 위치 인코딩 한계까지 자동으로 늘어나는 건 아닙니다.

vLLM을 쓴다면 max_model_len, gpu_memory_utilization 같은 설정과 시작 로그에 나오는 KV Cache 용량을 같이 보는 편이 좋습니다. GPU 메모리만 볼 게 아니라 실제 요청 길이와 동시 요청 수도 같이 봐야 하고요.

## GPU를 여러 장 쓰는 방법도 목적에 따라 다르다

| 방식 | 어떻게 나누는지 | 고려할 점 |
| --- | --- | --- |
| Tensor Parallelism (TP) | 한 레이어의 연산과 Weight 분할 | 레이어마다 GPU 간 통신 |
| Pipeline Parallelism (PP) | 레이어를 GPU별로 분할 | 단계 간 대기 및 통신 |
| Data Parallelism (DP) | 모델 복제 후 요청 분산 | 복제본마다 Weight 메모리 필요 |
| Expert Parallelism (EP) | MoE의 Expert 분산 | 토큰 라우팅과 통신, 부하 균형 |

GPU 두 장의 VRAM을 단순히 더한 숫자가 한 장의 VRAM과 같은 건 아니에요. 특히 PCIe 연결인지 NVLink를 쓸 수 있는지에 따라 통신 비용이 달라집니다. GPU 병렬화는 여기서 직접 수행한 결과가 아니라 증설 시 비교할 선택지로 정리했습니다.

## 서빙할 때 제가 같이 보고 싶은 지표들

| 지표 | 확인하려는 것 |
| --- | --- |
| TTFT | 요청 후 첫 토큰까지 걸리는 시간 |
| TPOT | 첫 토큰 이후 토큰당 생성 시간 |
| Throughput | 서버 전체가 초당 처리하는 토큰과 요청 수 |
| P95 응답 시간 | 요청이 몰릴 때 느려지는 정도 |
| KV Cache 사용률과 Hit Rate | 메모리 부족 및 Prefix 재사용 효과 |

테스트할 때는 입력 길이, 출력 길이, 동시 요청 수를 맞춰야 합니다. Agent가 연쇄 호출을 하는 경우에는 모델 호출 하나의 속도뿐 아니라 전체 업무가 끝날 때까지의 시간도 중요하고요.

제가 지금 쓰는 Weight 양자화와 KV Cache 양자화, Offloading 조합은 제한된 VRAM을 활용하기 위한 선택입니다. RAM 증설도 고려하고 있지만 CPU에 캐시를 더 보관하는 것과 GPU에서 한 요청을 더 길게 처리하는 건 같은 문제가 아니에요. 현재 구성의 tok/s 개선율이나 최대 동시 요청 수는 이 글에서 실측값으로 제시하지 않았습니다.

GPU를 추가하기 전에 모델 Weight 때문에 부족한 건지, 긴 요청의 KV Cache 때문인지, 아니면 이미 요청이 몰려 연산이 밀리는 건지부터 구분하는 편이 좋겠습니다.

참고: [vLLM Expert Parallel Deployment](https://docs.vllm.ai/en/stable/serving/expert_parallel_deployment/), [vLLM Engine Arguments](https://docs.vllm.ai/en/latest/configuration/engine_args/)

2026년 11월 기준으로 정리한 내용이며, 오프로딩의 세부 동작은 엔진과 버전에 따라 다릅니다. 관련 설정은 [vLLM 공식 문서](https://docs.vllm.ai/)에서 사용하는 버전에 맞춰 확인하는 게 좋겠습니다.
