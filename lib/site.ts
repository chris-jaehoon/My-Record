export const SITE = {
  name: "이제는 사람이 쓴 글이 더 적어져서 쓰는 블로그",
  title: "이제는 사람이 쓴 글이 더 적어져서 쓰는 블로그",
  description:
    "ai가 글을 너무 많이써서 귀한 인간 자료 남기기용",
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
    ko: "AI 에이전트가 읽고 인용하기 좋게 구조화한, 100% 사람이 직접 경험하고 검증해 쓴 글",
    en: "Written and verified 100% by a human, structured so AI agents can read and cite it.",
    badge: "Human-written, AI-readable",
  },
} as const;
