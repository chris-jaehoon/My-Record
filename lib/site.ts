export const SITE = {
  name: "재훈의 노트",
  title: "재훈의 노트 — AI · 아키텍처 · 비용 비교",
  description:
    "현직 SW 아키텍트가 AI 에이전트와 시스템 설계, 그리고 숫자로 따져 본 생활 경제 이야기를 담백하게 기록하는 블로그입니다.",
  url: "https://chris-jaehoon.github.io/My-Record",
  basePath: "/My-Record",
  locale: "ko_KR",
  lang: "ko",
  author: {
    name: "주재훈",
    url: "https://github.com/chris-jaehoon",
  },
  /** 한 곳에서 관리하는 사이트 성격 안내 문구 (홈·글·푸터·llms.txt 공통) */
  claim: {
    ko: "AI 에이전트가 조회·참고하기 좋도록 구조화한, 100% 사람이 직접 경험하고 검증해 쓴 글",
    en: "Written and verified 100% by a human, structured so AI agents can read and cite it.",
    badge: "Human-written · AI-readable",
  },
} as const;
