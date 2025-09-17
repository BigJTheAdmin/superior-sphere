import { defineCollection, z } from "astro:content";

/**
 * Collection id MUST be "post" because your routes use getCollection("post").
 * Support BOTH `date` and `pubDate` so old/new posts work.
 */
const post = defineCollection({
  type: "content",
  schema: z.object({
    title: z.string(),
    description: z.string().max(200).optional(),
    // Accept either `date` or `pubDate`
    date: z.coerce.date().optional(),
    pubDate: z.coerce.date().optional(),
    updatedDate: z.coerce.date().optional(),
    author: z.string().default("PingTraceSSH"),
    tags: z.array(z.string()).default([]),
    heroImage: z.string().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { post };
