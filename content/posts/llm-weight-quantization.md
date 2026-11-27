---
title: "LLM 양자화, 4비트면 다 같을까? PTQ부터 NVFP4까지"
description: "2026년 11월 기준 ONNX PTQ와 LLM 양자화 모델 서빙 경험을 바탕으로 INT4, NVFP4, AWQ, GPTQ, QAT 및 Calibration 데이터 선택을 정리했습니다."
date: "2026-11-28"
category: "AI, SW 아키텍처"
tags: ["LLM", "양자화", "GPU", "vLLM"]
---

LLM을 직접 띄워 쓰다 보면 모델 자체가 차지하는 GPU 메모리부터 부담스럽습니다. 저도 지금 Weight 양자화를 쓰면서 KV Cache는 별도로 오프로딩하고 있는데요. 둘 다 메모리를 아끼기 위한 방법이지만, 어느 부분을 줄이는지는 완전히 달라요.

대학원에서 Depth Anything 계열 모델을 CPU에서 돌리려고 PyTorch 모델을 ONNX로 변환하고 PTQ를 적용한 경험이 있어요. 지금은 vLLM에서 NVFP4 Weight와 KV Cache 양자화를 사용하는 쪽으로 관심이 옮겨갔습니다. 같은 양자화라도 모델을 변환하는 작업과 이미 양자화된 모델을 서빙하는 작업은 구분해야 하더라고요.

양자화를 하면 모델이 작아진다는 건 많이들 아시겠지만, 어떤 방식으로 숫자를 줄이고 어떤 데이터를 써야 하는지부터 정리해 봤습니다.

## FP16 모델을 INT4로 바꾸면 얼마나 줄어들까?

파라미터가 700억 개인 70B 모델을 예로 들어볼게요. Weight만 저장한다고 가정하고 파라미터 수에 저장 비트 수를 곱하면 됩니다.

| Weight 형식 | 파라미터당 저장 크기 | 70B Weight 이론 용량 |
| --- | ---: | ---: |
| FP32 | 4 bytes | 280 GB |
| FP16 / BF16 | 2 bytes | 140 GB |
| INT8 / FP8 | 1 byte | 70 GB |
| INT4 | 0.5 byte | 35 GB |

FP16에서 INT4로 바꾸면 Weight만 놓고 봤을 때 105 GB를 줄이는 셈이에요. 표는 1 GB = 10억 bytes로 계산했고, 실제 모델을 로딩한 뒤 측정한 값은 아닙니다.

실제로는 Scale, Zero Point, 양자화하지 않은 레이어와 실행에 필요한 메모리도 들어갑니다. 그래서 35 GB짜리 Weight라고 해서 VRAM 35 GB에 모델이 무조건 올라가는 건 아니에요.

## 실제 Qwen 체크포인트를 A6000에서 비교하면?

70B 이론값만 보면 실제 모델 파일이 얼마나 큰지 감이 잘 안 와요. 그래서 Qwen3.8-27B를 기준으로 비교했습니다.

| 모델 | Weight 형식 | 공개 파일 용량(약 GB) | A6000 48GB 한 장 |
| --- | --- | ---: | --- |
| [Qwen3.8-27B](https://huggingface.co/Qwen/Qwen3.8-27B) | BF16 | 55.6 | Weight만으로도 초과 |
| [Qwen3.8-27B-FP8](https://huggingface.co/Qwen/Qwen3.8-27B-FP8) | FP8 | 30.9 | 로딩 여지 있음, 커널 확인 |
| [derikn/Qwen3.8-27B-AWQ-INT4](https://huggingface.co/derikn/Qwen3.8-27B-AWQ-INT4) | INT4 W4A16 | 19.6 | KV 공간 확보에 유리, 호환성 확인 |
| [nvidia/Qwen3.8-27B-NVFP4](https://huggingface.co/nvidia/Qwen3.8-27B-NVFP4) | 혼합 NVFP4/FP8 | 21.9 | 네이티브 FP4 미지원, 실행 가능 여부 별도 확인 |

BF16과 FP8은 Qwen 공식 배포본이고 AWQ와 NVFP4는 각각 외부 개발자와 NVIDIA의 양자화 배포본입니다. 파일 용량은 공개 자료의 근삿값으로, [AWQ 모델 카드](https://huggingface.co/derikn/Qwen3.8-27B-AWQ-INT4/blob/main/README.md)와 [Hugging Face 비교 기록](https://huggingface.co/Qwen/Qwen3.8-27B/discussions/192), [INT4 비교 자료](https://huggingface.co/TelperionAI/Qwen3.8-27B-INT4-AWQ-GPTQ)를 참고했습니다. 원본은 약 55.6GB로 보고되어 있습니다. 전체 파일 목록을 직접 합산하는 조회는 완료하지 못했으므로 정확한 다운로드 크기는 각 저장소의 Files 탭에서 확인하세요. 실제 VRAM과 실측 tok/s는 아닙니다. FP16과 BF16은 둘 다 2 bytes를 사용합니다.

BF16 대비 AWQ 공개 파일 크기는 약 65% 작습니다(1 - 19.6 / 55.6). A6000 48GB(Ampere, SM 8.6)는 FP8이나 NVFP4 네이티브 연산을 지원하지 않으므로 Weight 형식과 실제 실행 커널을 따로 확인해야 합니다. 특히 NVIDIA의 혼합 NVFP4/FP8 체크포인트가 A6000에서 그대로 실행된다고 보장할 수는 없어요.

제 서버의 Host RAM은 512GB이고 오프로딩은 최대 100GB까지 사용해 봤습니다. Qwen3.8의 Hybrid Attention 구조와 캐시 용량별 계산은 [LLM 서빙 글](../llm-kv-cache-offloading/)에 정리했습니다. 위 모델들을 모두 직접 실행해 본 비교는 아닙니다.

RTX PRO 4500 Blackwell은 32GB GDDR7과 5세대 Tensor Core를 갖추고 FP8, FP4 네이티브 연산을 지원합니다. A6000의 48GB보다 VRAM은 적지만 지원되는 NVFP4 W4A4 커널을 쓰면 정밀도 변환에 의존하는 경로와 다른 연산 성능을 기대할 수 있어요. 반대로 긴 입력과 동시 요청을 위한 KV 공간은 A6000이 유리할 수 있습니다. 두 GPU의 실제 tok/s를 직접 비교한 결과는 아닙니다. [NVIDIA 공식 사양](https://www.nvidia.com/en-us/products/workstations/professional-desktop-gpus/rtx-pro-4500/)과 [서빙 글](../llm-kv-cache-offloading/)에 정리한 비교를 참고하세요.

## 양자화하면 컨텍스트도 길어질까?

Weight 양자화로 확보한 VRAM을 KV Cache에 쓸 수 있으니, 메모리 때문에 길이를 제한하고 있었다면 도움이 됩니다. 근데 Weight를 INT4로 바꾼다고 KV Cache까지 자동으로 INT4가 되는 건 아니더라고요.

가령 32개 레이어, KV Head 8개, Head Dimension 128인 모델의 32,768토큰 캐시를 계산하면 FP16일 때 4 GiB입니다. 캐시 자체를 FP8로 저장하면 이론상 2 GiB로 줄어듭니다. Weight와는 별개의 설정인 거죠.

모델마다 구조가 다르기 때문에 이 수치를 앞에서 예로 든 모든 70B 모델에 그대로 적용하면 안 됩니다.

## 4비트라고 다 같은 양자화가 아니다

| 방식 | 특징 |
| --- | --- |
| AWQ | 활성값 정보를 이용해 중요한 Weight의 양자화 오차를 줄이는 방식 |
| GPTQ | 레이어 출력의 재구성 오차를 줄이는 방향으로 Weight를 양자화 |
| FP8 | 8비트 부동소수점 형식으로, 지원 환경에서는 Weight와 Activation 연산에도 활용 |
| NVFP4 | E2M1 기반 4비트 부동소수점과 작은 블록별 Scale을 사용하는 NVIDIA 형식 |
| RTN | 정해진 Scale에 맞춰 가장 가까운 표현값으로 반올림하는 기본적인 방식 |
| SmoothQuant | Activation의 큰 값이 양자화를 어렵게 하는 문제를 Weight 쪽으로 재분배하는 방식 |
| NF4 | 정규분포에 가까운 Weight에 맞춘 4비트 표현 방식으로 QLoRA에 주로 사용 |

AWQ와 GPTQ는 흔히 4비트 Weight 양자화에 쓰이는 알고리즘이고, FP8과 NVFP4는 수를 표현하는 형식입니다. 서로 같은 분류가 아니에요. 알고리즘과 데이터 형식, Weight만 줄일지 Activation까지 줄일지, Scale을 텐서 전체에 둘지 채널이나 그룹별로 둘지까지 정해야 합니다.

예를 들어 W4A16은 Weight는 4비트, Activation은 16비트로 처리한다는 뜻입니다. W4A4는 둘 다 4비트로 처리하는 구성이지만 누산 정밀도까지 반드시 4비트라는 뜻은 아니에요. 숫자만 보고 무조건 4비트가 더 빠르다고 판단하기는 어려워요.

Decode 단계에서 Weight를 읽는 메모리 대역폭 부담이 줄면 빨라질 수 있지만, 반대로 역양자화 비용이나 지원하지 않는 커널 때문에 기대한 속도가 안 나올 수도 있습니다.

## 모델 학습이 끝난 뒤 양자화하는 PTQ

Post-Training Quantization(PTQ)은 학습이 끝난 모델을 가져와 낮은 정밀도로 변환하는 방법이에요. 보통 기존 모델 전체를 다시 학습할 필요가 없습니다. 일부 방식은 Calibration 과정에서 모델 출력이나 Weight의 양자화 오차를 줄이는 최적화를 수행하기도 합니다.

반면 Quantization-Aware Training(QAT)은 학습 중에 양자화 오차를 모사해서 모델이 그 오차에 적응하도록 Weight를 업데이트합니다.

| 방식 | Weight 추가 학습 | 데이터의 역할 |
| --- | --- | --- |
| PTQ | 일반적으로 전체 재학습 없음 | 필요에 따라 Scale과 양자화 범위 추정 |
| QAT | 있음 | 양자화 오차에 적응하도록 학습 |
| SFT | 있음 | 원하는 답변과 업무 방식 학습 |
| QLoRA | 주로 Adapter만 학습 | 양자화된 Base Model 위에서 저비용 Fine-tuning |

SFT나 LoRA는 모델의 답변 능력을 원하는 방향으로 바꾸는 방법이고, PTQ는 기존 모델을 낮은 정밀도로 효율적으로 실행하려는 작업입니다. 둘 다 학습 이후에 하는 일이지만 목적이 달라요.

제가 대학원에서 했던 작업은 이미 학습된 Depth Estimation 모델을 ONNX로 변환한 뒤 양자화를 적용해 CPU 추론에 맞추는 작업이었습니다. 모델을 처음부터 다시 학습하는 것보다 배포 환경에 맞춰 최적화하는 데 초점이 있었어요. 당시 정확한 비트 수나 Calibration 방식은 이 글에서 확인된 기록으로 제시하지 않습니다.

## Training Set과 Calibration Set은 어떻게 다를까?

PTQ를 알아보다 보면 데이터가 필요한 경우가 있어서 Training Set으로 다시 학습하는 건가 싶을 수 있어요. Static PTQ에서는 대표 입력을 모델에 통과시켜 Activation 범위를 관찰하고 Scale을 정합니다. Dynamic Quantization은 실행 중 Activation의 범위에 맞춰 Scale을 정할 수 있고, Weight-only 방식 중에는 별도 입력 데이터가 필요 없는 방법도 있습니다.

| 데이터 | 목적 |
| --- | --- |
| Training Set | 모델이나 Adapter의 Weight 학습 |
| Calibration Set | 양자화 범위와 Scale, 방식에 따라 재구성 오차 최적화 |
| Evaluation Set | 양자화 이후 품질 손실 확인 |

예를 들어 코드 분석 모델을 양자화한다면 일반적인 대화만 Calibration에 넣는 것보다는 실제 업무에 가까운 코드, 요구사항, 검색 결과가 섞인 긴 입력도 후보에 넣어 보는 게 좋겠어요. 이미지 모델이라면 실제 배포 환경과 비슷한 이미지 분포를 고려해야 하고요.

평가 데이터는 Calibration 데이터와 분리하고, 같은 입력으로 원본과 양자화 모델을 비교하는 게 중요합니다. 데이터 개수는 방법과 모델에 따라 달라요. NVIDIA Model Optimizer의 PTQ 안내에는 128~512개 샘플을 사용하는 사례가 나오지만 모든 모델에 적용되는 필수 기준은 아닙니다.

이 부분은 데이터셋을 직접 구성해 실험한 LLM 결과가 아니라, 앞으로 양자화 품질을 비교할 때 적용할 기준으로 정리했습니다. SFT나 QLoRA를 직접 수행한 결과도 여기에는 포함하지 않았어요.

## 지금 사용하는 NVFP4는 어떤 점이 다를까?

현재 vLLM 서빙에서는 NVFP4 Weight 양자화와 KV Cache 양자화, Host RAM 기반 캐시 오프로딩을 같이 사용하고 있습니다. Weight가 작아지면 캐시에 할당할 공간이 늘고, 캐시 정밀도까지 줄이면 같은 공간에 더 많은 토큰을 보관할 여지가 생겨요.

NVFP4는 4비트 값만 저장하는 게 아니라 16개 값 단위의 FP8 Scale과 상위 Scale을 함께 쓰는 형식입니다. 그래서 실제 메모리 사용량은 파라미터당 정확히 0.5 byte로 떨어지지 않습니다. GPU와 커널이 해당 형식을 제대로 지원하는지도 확인해야 해요.

이 구성에서 제가 확인한 경험은 양자화 모델을 서빙하고 메모리 관리 설정을 사용하는 부분입니다. NVFP4 체크포인트를 직접 Calibration해서 제작했다고 말하는 것은 별개의 이야기입니다.

## 실제로 비교할 때는 메모리만 보면 안 된다

같은 모델에 같은 프롬프트를 넣고 비교하더라도 입력 길이와 동시 요청 수를 맞춰야 해요. 제가 서빙 구성을 비교한다면 적어도 아래 항목은 같이 볼 것 같습니다.

- 모델 로딩 후 VRAM 사용량과 KV Cache 용량
- 첫 토큰이 나오기까지 걸리는 시간(TTFT)
- 생성 중 tok/s와 동시 요청 처리량
- 긴 문서나 코드 분석에서의 응답 품질

특히 코드 분석에 쓰는 모델이라면 짧은 질문 몇 개에 답을 잘한다고 기존 모델과 품질이 같다고 보기는 어렵습니다. 실제로 쓰려는 긴 입력과 복잡한 추론 문제를 넣어 봐야 해요.

현재 제가 쓰고 있는 구성의 양자화 전후 속도나 품질 수치는 아직 이 글에 따로 넣지 않았습니다. 위 메모리 수치는 계산값이고, 2026년 11월 기준 세부 지원 방식은 GPU와 서빙 엔진 버전에 따라 달라질 수 있어요.

설정할 때는 [vLLM 양자화 문서](https://docs.vllm.ai/en/latest/features/quantization/)에서 GPU별 지원 여부부터 확인하는 편이 좋겠습니다.

참고: [NVIDIA PTQ 가이드](https://developer.nvidia.com/blog/optimizing-llms-for-performance-and-accuracy-with-post-training-quantization/), [Model Optimizer PTQ Recipes](https://github.com/NVIDIA/Model-Optimizer/blob/main/modelopt_recipes/ptq.md)
