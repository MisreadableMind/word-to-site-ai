import OpenAI from 'openai';
import { z } from 'zod';
import { zodTextFormat } from 'openai/helpers/zod';
import { compact, differenceBy, filter, keyBy, map, orderBy, size, words } from 'lodash-es';
import { config } from '../config';
import { SkinItems, type SkinItem } from '../schemas/skin';
import type { Skin } from './base-site-service';

export type SkinQuery = Partial<{
  industry: string;
  services: string;
  aboutUs: string;
  companyName: string;
}>;

const AiRanking = z.object({
  recommended: z.array(z.object({
    slug: z.string().describe('Skin slug from the available list'),
    reason: z.string().describe('Short reason why this skin fits, 1 sentence'),
    confidence: z.number().describe('Match confidence from 0 to 1'),
  })).describe('Top 5-8 skins ranked by relevance, best first'),
});

const relevance = (skin: Skin, terms: string[]) => {
  const haystack = `${skin.keywords} ${skin.category} ${skin.title}`.toLowerCase();
  return size(filter(terms, (t) => size(t) > 2 && haystack.includes(t)));
};

const byRelevance = (skins: Skin[], query: SkinQuery) => {
  const terms = words(compact([query.industry, query.services, query.aboutUs]).join(' ').toLowerCase());
  return orderBy(skins, (skin) => relevance(skin, terms), 'desc');
};

const rankByKeyword = (skins: Skin[], query: SkinQuery): SkinItem[] => SkinItems.parse(byRelevance(skins, query));

const rankByAI = async (skins: Skin[], query: SkinQuery): Promise<SkinItem[]> => {
  const openai = new OpenAI({ apiKey: config.openai?.apiKey });
  const catalog = map(skins, (s) => `${s.slug} (${s.title}) [${s.category}] — ${s.keywords}`).join('\n');

  const { output_parsed } = await openai.responses.parse({
    model: 'gpt-5-mini',
    input: [
      {
        role: 'system',
        content: `You recommend website skins/templates. Given a user's business info, pick the 5-8 most relevant skins from this catalog. Rank by relevance, best first.\n\nAvailable skins:\n${catalog}`,
      },
      {
        role: 'user',
        content: `Company: ${query.companyName || 'N/A'}\nIndustry: ${query.industry || 'N/A'}\nServices: ${query.services || 'N/A'}\nAbout: ${query.aboutUs || 'N/A'}`,
      },
    ],
    text: { format: zodTextFormat(AiRanking, 'skin_recommendation') },
  });

  const recs = output_parsed?.recommended ?? [];
  const bySlug = keyBy(skins, 'slug');
  const ranked = compact(map(recs, (r) => bySlug[r.slug] && { ...bySlug[r.slug], reason: r.reason, confidence: r.confidence }));
  const rest = byRelevance(differenceBy(skins, recs, 'slug'), query);
  return SkinItems.parse([...ranked, ...rest]);
};

export const recommendSkins = async (skins: Skin[], query: SkinQuery): Promise<SkinItem[]> => {
  if (!config.openai?.apiKey) return rankByKeyword(skins, query);
  try {
    return rankByAI(skins, query);
  } catch (error) {
    console.warn('Skin AI ranking failed, keyword fallback', error);
    return rankByKeyword(skins, query);
  }
};
