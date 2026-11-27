# 재훈의 노트

AI · 소프트웨어 아키텍처와 숫자로 비교하는 생활 경제를 다루는 정적 블로그입니다.
Next.js App Router 의 `output: 'export'` 로 빌드해 GitHub Pages(`https://chris-jaehoon.github.io/My-Record/`)에 배포합니다.

## 구성

- **프레임워크** Next.js (App Router) · TypeScript · 정적 HTML export
- **아이콘** `react-icons` — 테마 전환, 날짜, 읽기 시간, 뒤로가기 4곳에만 사용
- **글** `content/posts/*.md` 마크다운 + frontmatter
- **광고** Google AdSense 스크립트/슬롯 구조 (`components/AdSlot.tsx`, `public/ads.txt`)
- **SEO/GEO** 페이지별 metadata, JSON-LD `Article` 스키마, `sitemap.xml`, `robots.txt`(AI 크롤러 허용), `llms.txt`

## 로컬 실행

```bash
npm install
npm run dev          # http://localhost:3000/My-Record/
npm run build        # 정적 산출물 out/
npx serve out        # 빌드 결과를 로컬에서 확인
```

## 글 추가

`content/posts/` 에 마크다운 파일을 하나 추가하면 목록·사이트맵·이전/다음 글이 자동 반영됩니다.

```markdown
---
title: "글 제목"
description: "검색 결과와 AI 답변에 쓰일 한두 문장 요약"
date: "2026-11-27"
category: "AI · SW 아키텍처"
tags: ["AI", "LLM"]
---

본문...
```

## Google AdSense 연결

1. [AdSense](https://adsense.google.com) 에서 사이트(`chris-jaehoon.github.io/My-Record`)를 추가하고 승인을 받습니다.
2. 발급받은 **Publisher ID**(`ca-pub-...`)를 환경변수로 넣습니다.
   - 로컬: `.env.local` 에 `NEXT_PUBLIC_ADSENSE_ID=ca-pub-...`
   - GitHub Actions: 저장소 **Settings → Secrets and variables → Actions → Variables** 에 `NEXT_PUBLIC_ADSENSE_ID` 추가 (워크플로가 이 값을 빌드에 넘깁니다)
3. 광고 단위를 만들고 슬롯 ID 두 개를 변수로 넣습니다.
   - `NEXT_PUBLIC_ADSENSE_SLOT_TOP` (본문 상단)
   - `NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM` (본문 하단)
4. `public/ads.txt` 의 안내대로 `google.com, pub-..., DIRECT, f08c47fec0942fa0` 한 줄을 활성화합니다.
5. 값이 비어 있으면 AdSense 스크립트는 로드되지 않고 광고 영역도 렌더링되지 않습니다(로컬 개발에서만 점선 플레이스홀더 표시).

## 배포

`main` 브랜치에 푸시하면 `.github/workflows/deploy.yml` 이 빌드 후 GitHub Pages 로 배포합니다.
저장소 **Settings → Pages → Build and deployment → Source** 가 **GitHub Actions** 로 되어 있어야 합니다.
