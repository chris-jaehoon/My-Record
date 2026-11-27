import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FiArrowLeft, FiCalendar, FiClock } from "react-icons/fi";
import AdSlot from "@/components/AdSlot";
import JsonLd from "@/components/JsonLd";
import { SITE } from "@/lib/site";
import {
  formatDate,
  getAdjacentPosts,
  getAllPosts,
  getPost,
} from "@/lib/posts";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) return {};

  const url = `${SITE.url}/posts/${post.slug}/`;

  return {
    title: post.title,
    description: post.description,
    keywords: [post.category, ...post.tags],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: SITE.locale,
      url,
      siteName: SITE.name,
      title: post.title,
      description: post.description,
      publishedTime: `${post.date}T09:00:00+09:00`,
      modifiedTime: `${post.date}T09:00:00+09:00`,
      authors: [SITE.author.name],
      tags: post.tags,
      images: [
        {
          url: `${SITE.url}/og.png`,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
      images: [`${SITE.url}/og.png`],
    },
  };
}

export default async function PostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getPost(slug);
  if (!post) notFound();

  const { newer, older } = getAdjacentPosts(post.slug);
  const url = `${SITE.url}/posts/${post.slug}/`;

  const topSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_TOP?.trim();
  const bottomSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_BOTTOM?.trim();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": url,
    headline: post.title,
    description: post.description,
    inLanguage: "ko-KR",
    datePublished: `${post.date}T09:00:00+09:00`,
    dateModified: `${post.date}T09:00:00+09:00`,
    articleSection: post.category,
    keywords: post.tags.join(", "),
    image: [`${SITE.url}/og.png`],
    author: {
      "@type": "Person",
      name: SITE.author.name,
      url: SITE.author.url,
    },
    publisher: {
      "@type": "Organization",
      name: SITE.name,
      url: `${SITE.url}/`,
    },
    isPartOf: {
      "@type": "WebSite",
      "@id": `${SITE.url}/#website`,
      name: SITE.name,
      url: `${SITE.url}/`,
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    url,
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <div className="container">
        <article>
          <header className="post-header">
            <Link href="/" className="back-link">
              <FiArrowLeft aria-hidden="true" />
              글 목록
            </Link>

            {post.category ? (
              <span className="post-category">{post.category}</span>
            ) : null}

            <h1>{post.title}</h1>

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
          </header>

          <AdSlot slot={topSlot} position="top" />

          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          <AdSlot slot={bottomSlot} position="bottom" />

          <nav className="post-nav" aria-label="다른 글">
            {older ? (
              <Link href={`/posts/${older.slug}/`}>
                <span className="post-nav__label">이전 글</span>
                <span className="post-nav__title">{older.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {newer ? (
              <Link href={`/posts/${newer.slug}/`} className="post-nav__next">
                <span className="post-nav__label">다음 글</span>
                <span className="post-nav__title">{newer.title}</span>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </article>
      </div>
    </>
  );
}
