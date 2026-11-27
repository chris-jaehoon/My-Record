import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/posts";
import { SITE } from "@/lib/site";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const posts = getAllPosts();
  const newest = posts[0]?.date ?? "2026-11-27";
  const newestDate = new Date(`${newest}T09:00:00+09:00`);

  return [
    {
      url: `${SITE.url}/`,
      lastModified: newestDate,
      changeFrequency: "weekly",
      priority: 1,
    },
    ...posts.map((post) => ({
      url: `${SITE.url}/posts/${post.slug}/`,
      lastModified: new Date(`${post.date}T09:00:00+09:00`),
      changeFrequency: "monthly" as const,
      priority: 0.8,
    })),
  ];
}
