---
title: "LLM 서빙할 때 GPU만 늘리면 될까? 모델부터 메모리까지"
description: "2026년 11월 기준 RTX A6000 48GB와 Host RAM 512GB 환경에서 Qwen 양자화 모델, MoE, KV Cache 및 최대 100GB 오프로딩 경험을 정리했습니다."
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

## A6000 48GB 한 장으로 Qwen을 띄운다면?

제가 사용하는 서버에는 Host RAM이 512GB 있고, 오프로딩은 최대 100GB까지 해봤어요. 512GB 전부를 GPU 메모리처럼 쓰는 건 아닙니다. 아래는 RTX A6000(Ampere, SM 8.6) 한 장을 기준으로 비교한 내용이고, 실제 GPU 장수나 모든 체크포인트를 직접 구동했다는 뜻은 아니에요.

같은 모델에서 정밀도만 바꿔 보는 게 이해하기 편해서 Qwen2.5-32B-Instruct의 공식 Hugging Face 체크포인트를 비교해 봤습니다.

| 모델 | Weight 형식 | 체크포인트 크기(약 GB) | A6000 48GB 한 장 |
| --- | --- | ---: | --- |
| [Qwen2.5-32B-Instruct](https://huggingface.co/Qwen/Qwen2.5-32B-Instruct/tree/main) | BF16 | 65.5 | Weight만으로도 초과 |
| [GPTQ-Int8](https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-GPTQ-Int8/tree/main) | INT8 | 35.1 | 로딩 여지 있음, KV 공간 제한 |
| [GPTQ-Int4](https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-GPTQ-Int4/tree/main) | INT4 | 19.3 | KV 공간 확보에 유리 |
| [AWQ](https://huggingface.co/Qwen/Qwen2.5-32B-Instruct-AWQ/tree/main) | INT4 | 19.3 | KV 공간 확보에 유리 |

파일 목록의 safetensors 용량을 반올림한 값입니다. 디스크 용량(십진 GB)이지 실제 GPU 메모리 사용량이나 제가 측정한 tok/s가 아니에요. FP16과 BF16은 둘 다 2 bytes를 쓰므로 Weight 크기는 같은 수준입니다. 실제 로딩에는 CUDA 작업 공간과 KV Cache도 들어갑니다.

A6000은 Ampere 기반으로 FP16/BF16, INT8/INT4 Tensor Core 연산을 지원하지만 FP8이나 NVFP4 네이티브 Tensor Core 연산은 지원하지 않아요. FP8 또는 NVFP4 체크포인트도 엔진과 버전에 따라 Weight를 복원해서 계산하는 커널로 실행할 수 있지만, 최신 GPU와 동일한 저정밀 연산 속도를 기대하면 안 됩니다.

| GPU 세대 | 저정밀 연산에서 확인할 점 |
| --- | --- |
| Ampere (RTX A6000) | AWQ/GPTQ W4A16 등 지원 커널, FP8/FP4 네이티브 연산 없음 |
| Ada (RTX 6000 Ada) | FP8 Tensor Core 지원, NVFP4 네이티브 연산 없음 |
| Hopper (H100) | FP8 Tensor Core 지원, NVFP4 네이티브 연산 없음 |
| Blackwell | FP8 및 NVFP4 네이티브 연산 지원, 엔진과 커널 확인 필요 |

같은 4비트라도 저장 형식과 실제 연산 정밀도가 다릅니다. A6000이라면 AWQ/GPTQ와 Marlin 같은 지원 커널부터 확인하는 게 좋겠어요. [NVIDIA RTX A6000 사양](https://www.nvidia.com/en-us/products/workstations/rtx-a6000/)과 [vLLM 양자화 호환표](https://docs.vllm.ai/en/stable/features/quantization/)를 참고했습니다.

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

## Host RAM 512GB 중 최대 100GB까지 오프로딩

제가 실제로 사용해 본 오프로딩 용량은 최대 100GB입니다. RAM이 512GB 있다고 해서 전부 할당하지는 않았어요. 아래는 설정 용량을 늘릴 때 얼마나 더 많은 KV를 보관할 수 있는지 계산해 본 표입니다.

Qwen2.5-32B의 64개 레이어, KV Head 8개, Head Dimension 128 기준으로 BF16 KV는 토큰당 256 KiB, FP8 KV는 128 KiB입니다. 계산 편의를 위해 아래는 GiB 단위로 비교합니다. 제가 말한 최대 100GB의 실제 설정 단위와 런타임 메모리 사용량은 별도로 측정하지 않았습니다.

| CPU KV 버퍼 | BF16 KV 토큰 슬롯 | FP8 KV 토큰 슬롯 | 32K(32,768토큰) 캐시 상당량 BF16 / FP8 |
| ---: | ---: | ---: | ---: |
| 0 GiB | 0 | 0 | 0 / 0 |
| 16 GiB | 65,536 | 131,072 | 2 / 4 |
| 32 GiB | 131,072 | 262,144 | 4 / 8 |
| 64 GiB | 262,144 | 524,288 | 8 / 16 |
| 100 GiB | 409,600 | 819,200 | 12.5 / 25 |

이건 CPU에 저장할 수 있는 캐시의 이론적인 총량입니다. 동시에 처리할 수 있는 요청 수나 단일 요청의 최대 컨텍스트가 아니에요. 블록 단위 할당과 Scale, 메타데이터 등의 오버헤드도 제외했습니다. 실제로 16, 32, 64 GiB 각각을 테스트해 속도를 측정했다는 의미도 아닙니다.

A6000의 GPU 메모리 대역폭은 768 GB/s이고 PCIe 4.0 x16의 이론적인 단방향 대역폭은 약 31.5 GB/s입니다. 예를 들어 8 GiB 캐시를 CPU에서 GPU로 한 번 전송한다면 이상적인 조건에서도 약 0.27초가 걸립니다. 실제 전송은 시스템 구성과 NUMA, pinned memory, 전송 중첩 등에 따라 달라져요.

오프로딩 용량을 늘린다고 항상 tok/s가 떨어지는 건 아닙니다. CPU 캐시 Hit로 Prefill 재계산을 피하면 오히려 TTFT가 개선될 수 있고, 활성 데이터가 빈번하게 왕복하면 느려질 수 있어요. 용량 자체보다 재사용률과 실제 전송량이 중요합니다.

vLLM에서 `--kv-offloading-size`는 KV CPU 버퍼의 GiB 단위 크기이고 TP 전체에 대한 합계입니다. 반면 `--cpu-offload-gb`는 GPU별 Weight 오프로딩 용량입니다. 둘을 같은 설정으로 보면 안 돼요. Weight를 CPU에 두는 경우 Forward마다 전송이 발생할 수 있어서 Decode 성능에 더 직접적인 영향을 줍니다. [vLLM 설정 문서](https://docs.vllm.ai/en/latest/configuration/engine_args/) 기준이며 버전에 따라 지원 여부는 달라집니다.

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

제가 지금 쓰는 Weight 양자화와 KV Cache 양자화, Offloading 조합은 제한된 VRAM을 활용하기 위한 선택입니다. Host RAM 512GB 중 최대 100GB까지 오프로딩을 사용해 봤지만 CPU에 캐시를 더 보관하는 것과 GPU에서 한 요청을 더 길게 처리하는 건 같은 문제가 아니에요. 현재 구성의 tok/s 개선율이나 최대 동시 요청 수는 이 글에서 실측값으로 제시하지 않았습니다.

GPU를 추가하기 전에 모델 Weight 때문에 부족한 건지, 긴 요청의 KV Cache 때문인지, 아니면 이미 요청이 몰려 연산이 밀리는 건지부터 구분하는 편이 좋겠습니다.

참고: [vLLM Expert Parallel Deployment](https://docs.vllm.ai/en/stable/serving/expert_parallel_deployment/), [vLLM Engine Arguments](https://docs.vllm.ai/en/latest/configuration/engine_args/)

2026년 11월 기준으로 정리한 내용이며, 오프로딩의 세부 동작은 엔진과 버전에 따라 다릅니다. 관련 설정은 [vLLM 공식 문서](https://docs.vllm.ai/)에서 사용하는 버전에 맞춰 확인하는 게 좋겠습니다.
