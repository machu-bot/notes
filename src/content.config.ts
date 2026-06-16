import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    issue: z.number(),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    labels: z.array(z.string()).default([]),
    summary: z.string().optional(),
  }),
});

export const collections = { posts };
