import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

const POSTS_DIR = path.join(process.cwd(), "content", "posts");

export type PostMeta = {
  slug: string;
  title: string;
  description: string;
  date: string;
  category: string;
  tags: string[];
  readingTime: number;
};

export type Post = PostMeta & {
  html: string;
  plain: string;
};

/** Korean-friendly reading time: roughly 450 non-space characters per minute. */
function estimateReadingTime(text: string): number {
  const chars = text.replace(/\s+/g, "").length;
  return Math.max(1, Math.round(chars / 450));
}

function readPost(fileName: string): Post {
  const slug = fileName.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(POSTS_DIR, fileName), "utf8");
  const { data, content } = matter(raw);

  const plain = content
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return {
    slug,
    title: String(data.title ?? slug),
    description: String(data.description ?? ""),
    date: String(data.date ?? ""),
    category: String(data.category ?? ""),
    tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
    readingTime: estimateReadingTime(plain),
    html: marked.parse(content) as string,
    plain,
  };
}

export function getAllPosts(): Post[] {
  if (!fs.existsSync(POSTS_DIR)) return [];
  return fs
    .readdirSync(POSTS_DIR)
    .filter((file) => file.endsWith(".md"))
    .map(readPost)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPost(slug: string): Post | undefined {
  return getAllPosts().find((post) => post.slug === slug);
}

export function getAdjacentPosts(slug: string): {
  newer?: PostMeta;
  older?: PostMeta;
} {
  const posts = getAllPosts();
  const index = posts.findIndex((post) => post.slug === slug);
  if (index === -1) return {};
  return { newer: posts[index - 1], older: posts[index + 1] };
}

export function formatDate(date: string): string {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(parsed);
}
