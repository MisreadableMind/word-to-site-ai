import { z } from 'zod';

export const SkinItem = z.object({
  slug: z.string(),
  title: z.string(),
  category: z.string().nullish().transform((v) => v ?? ''),
  demo_url: z.string().nullish().transform((v) => v ?? ''),
  keywords: z.string().nullish().transform((v) => v ?? ''),
  reason: z.string().default(''),
  confidence: z.number().default(0),
});

export const SkinItems = z.array(SkinItem);

export type SkinItem = z.infer<typeof SkinItem>;
