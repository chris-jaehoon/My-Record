# 이제는 사람이 쓴 글이 더 적어져서 쓰는 블로그

AI와 소프트웨어 아키텍처, 숫자로 비교하는 생활 경제를 다루는 정적 블로그입니다.
Next.js App Router 의 `output: 'export'` 로 빌드해 GitHub Pages(`https://chris-jaehoon.github.io/My-Record/`)에 배포합니다.

## 구성

- **프레임워크** Next.js (App Router), TypeScript, 정적 HTML export
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

`content/posts/` 에 마크다운 파일을 하나 추가하면 목록과 사이트맵, 이전/다음 글이 자동 반영됩니다.

```markdown
---
title: "글 제목"
description: "검색 결과와 AI 답변에 쓰일 한두 문장 요약"
date: "2026-11-27"
category: "AI/SW 아키텍처"
tags: ["AI", "LLM"]
---

본문...
```

## Google AdSense 연결

1. [AdSense](https://adsense.google.com) 에서 사이트(`chris-jaehoon.github.io/My-Record`)를 추가하고 승인을 받습니다.
2. 발급받은 **Publisher ID**(`ca-pub-...`)를 환경변수로 넣습니다.
   - 이 저장소는 `.env.production` 에 `NEXT_PUBLIC_ADSENSE_ID=ca-pub-4278170914101108` 을 커밋해 두어 `npm run deploy` 빌드에 그대로 적용됩니다.
   - 로컬에서 다른 값을 쓸 때: `.env.local` 에 `NEXT_PUBLIC_ADSENSE_ID=ca-pub-...`
   - GitHub Actions: 저장소 **Settings → Secrets and variables → Actions → Variables** 에 `NEXT_PUBLIC_ADSENSE_ID` 추가 (워크플로가 이 값을 빌드에 넘깁니다)
3. 광고 단위를 만들고 슬롯 ID 두 개를 변수로 넣습니다.
   - `NEXT_PUBLIC_ADSENSE_SLOT_TOP` (본문 상단)
   - `NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM` (본문 하단)
4. `public/ads.txt` 에 `google.com, pub-4278170914101108, DIRECT, f08c47fec0942fa0` 한 줄이 활성화되어 있습니다.
5. 값이 비어 있으면 AdSense 스크립트는 로드되지 않고 광고 영역도 렌더링되지 않습니다(로컬 개발에서만 점선 플레이스홀더 표시).

## 배포

현재는 **`gh-pages` 브랜치의 정적 산출물**로 배포됩니다.
(GitHub Pages → Source: *Deploy from a branch* → `gh-pages` / `/ (root)`)

```bash
npm run deploy            # 빌드 후 gh-pages 로 푸시
```

`npm run deploy` 는 `scripts/deploy.sh` 를 실행하며, 반영까지 보통 1분 안에 걸립니다.
글을 고친 뒤에는 `main` 에 커밋하고 `npm run deploy` 를 한 번 더 실행하면 됩니다.

### GitHub Actions 로 전환하려면

공식 워크플로(`actions/configure-pages` + `upload-pages-artifact` + `deploy-pages`)는
`docs/actions-deploy.yml` 에 준비되어 있습니다. 다만 현재 연결된 GitHub 앱에는
`workflows` 권한이 없어 `.github/workflows/` 파일을 푸시할 수 없습니다(403).
워크플로 쓰기 권한이 있는 토큰으로 연결한 뒤 아래를 하면 CI 배포로 바꿀 수 있습니다.

1. `docs/actions-deploy.yml` → `.github/workflows/deploy.yml`
2. GitHub Pages → Source: **GitHub Actions**
3. 저장소 Variables 에 `NEXT_PUBLIC_ADSENSE_ID` 등 등록
