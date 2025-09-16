// src/content/config.ts
import { defineCollection, z } from "astro:content";

/**
 * Stripped-down collections.
 * - Blog removed.
 * - Keep room for any lightweight data collections you actually use.
 */

export const collections = {
  // Example: keep a tiny "notes" or "tools" collection if you still need frontmatter-driven content.
  // Remove if unused.
  tools: defineCollection({
    schema: z.object({
      title: z.string(),
      description: z.string().optional(),
      updated: z.date().optional(),
      tags: z.array(z.string()).optional(),
      draft: z.boolean().optional().default(false),
    }),
  }),
};
