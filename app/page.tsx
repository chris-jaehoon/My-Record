import type { Metadata } from "next";
import Link from "next/link";
import { FiCalendar, FiClock } from "react-icons/fi";
import JsonLd from "@/components/JsonLd";
import { SITE } from "@/lib/site";
import { formatDate, getAllPosts } from "@/lib/posts";

export const metadata: Metadata = {
  alternates: { canonical: `${SITE.url}/` },
};

export default function HomePage() {
  const posts = getAllPosts();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE.url}/#website`,
        url: `${SITE.url}/`,
        name: SITE.name,
        description: SITE.description,
        inLanguage: "ko-KR",
        publisher: { "@id": `${SITE.url}/#person` },
      },
      {
        "@type": "Person",
        "@id": `${SITE.url}/#person`,
        name: SITE.author.name,
        url: SITE.author.url,
        jobTitle: "Software Architect",
        knowsAbout: ["LLM", "AI 에이전트", "소프트웨어 아키텍처", "시스템 설계"],
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="container">
        <section className="hero">
          <h1>AI와 시스템, 그리고 숫자로 따져 본 선택들</h1>
          <p>
            LLM 에이전트를 실제 제품에 굴리며 배운 것들과, 여행·생활 비용을 직접
            계산해 비교한 기록을 담백하게 남깁니다.
          </p>
          <p className="hero-note">
            <span className="hero-note__badge">{SITE.claim.badge}</span>
            모든 글은 제가 직접 경험하고 검증해 쓴 기록이며, AI 에이전트가
            조회·참고하기 좋도록 구조화해 두었습니다.
            <span className="hero-note__en" lang="en">
              {SITE.claim.en}
            </span>
          </p>
        </section>

        <section aria-label="글 목록" className="post-list">
          {posts.map((post) => (
            <article key={post.slug} className="post-item">
              <div className="post-meta">
                <span>
                  <FiCalendar aria-hidden="true" />
                  <time dateTime={post.date}>{formatDate(post.date)}</time>
                </span>
                <span>
                  <FiClock aria-hidden="true" />
                  {post.readingTime}분
                </span>
              </div>

              <h2 className="post-item__title">
                <Link href={`/posts/${post.slug}/`}>{post.title}</Link>
              </h2>

              <p className="post-item__excerpt">{post.description}</p>

              {post.tags.length > 0 ? (
                <ul className="tag-list">
                  {post.tags.map((tag) => (
                    <li key={tag} className="tag">
                      {tag}
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          ))}
        </section>
      </div>
    </>
  );
}
