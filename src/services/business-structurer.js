import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { empty } from 'zod-empty';
import { config } from '../config.js';
import { buildWizardData } from '../utils/wizard-data.js';

const StructuredService = z.object({
  name: z.string(),
  description: z.string(),
  features: z.string(),
});

const StructuredTeamMember = z.object({
  name: z.string(),
  position: z.string(),
  bio: z.string(),
});

const StructuredBusinessFields = z.object({
  services: z.array(StructuredService),
  team: z.array(StructuredTeamMember),
  mission: z.string(),
  history: z.string(),
});

const SYSTEM_PROMPT = `You restructure company onboarding info into a strict format for a website wizard.

services
- Input is a list of service names. For each, output { name, description, features }.
- "name" must be the input string verbatim.
- "description" is exactly one sentence grounded in the company's industry, unique selling points, and tone.
- "features" is a comma-separated string of 3-5 short feature highlights, no leading dashes or bullets.
- Output one object per input service, in the same order. Do not add or remove services.

team
- Input is a freeform text about the team. Apply these rules in order:
  1. If the text names individuals with roles (e.g. "Alice Smith - CEO", "Bob Jones, CTO"), extract one entry per person.
  2. Else if the text mentions role categories without individuals (e.g. "former C-suite operators, ex-venture builders, data scientists"), emit one entry per distinct role with name = "" (blank).
  3. Else (no roles, no names) return an empty array.
- For each entry: { name, position, bio }.
  - "name" is the individual's full name, or "" when only a role category is present. Never invent names. If unsure whether a phrase is a name, leave name blank.
  - "position" is the role/title exactly as stated.
  - "bio" is one short sentence drawn from the input context, or "" if none.
- De-duplicate roles — do not emit two entries with the same position from one paragraph.

mission
- One present-tense sentence stating what the company does for whom and why, grounded in the provided industry, services, target audience, and unique selling points.
- Do not invent facts. If the inputs are too sparse to write a non-generic sentence, return "".

history
- One short paragraph, only if the inputs explicitly mention founding year, years of experience, milestones, founders, or origin story.
- Otherwise return "". Never fabricate dates, founders, or milestones.`;

export async function structureBusinessFields(business) {
  if (!config.openai?.apiKey) {
    return { ...business, ...empty(StructuredBusinessFields) };
  }

  const serviceNames = Array.isArray(business?.services)
    ? business.services
        .map((s) => (typeof s === 'string' ? s : s?.name))
        .filter((s) => typeof s === 'string' && s.trim())
    : [];

  const teamText = typeof business?.team === 'string' ? business.team.trim() : '';
  const hasMissionGrounding = Boolean(
    business?.industry || business?.targetAudience || business?.uniqueSellingPoints?.length,
  );

  if (!serviceNames.length && !teamText && !hasMissionGrounding) {
    return { ...business, ...empty(StructuredBusinessFields) };
  }

  try {
    const openai = new OpenAI({ apiKey: config.openai.apiKey });
    const response = await openai.responses.parse({
      model: 'gpt-5-mini',
      input: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: JSON.stringify({
            companyName: business?.name || '',
            industry: business?.industry || '',
            tone: business?.tone || '',
            tagline: business?.tagline || '',
            targetAudience: business?.targetAudience || '',
            uniqueSellingPoints: business?.uniqueSellingPoints || [],
            servicesInput: serviceNames,
            teamInput: teamText,
          }),
        },
      ],
      text: { format: zodTextFormat(StructuredBusinessFields, 'business_fields') },
    });

    const parsed = response.output_parsed;
    return {
      ...business,
      ...empty(StructuredBusinessFields),
      ...parsed,
    };
  } catch (error) {
    console.warn('Failed to structure business fields:', error.message);
    return { ...business, ...empty(StructuredBusinessFields) };
  }
}

export async function prepareWizardData(deploymentContext, contentContext, site) {
  const structuredBusiness = await structureBusinessFields(contentContext?.business);
  const enriched = { ...contentContext, business: structuredBusiness };
  return buildWizardData(deploymentContext, enriched, site);
}
