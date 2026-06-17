import { get, isNil, map } from 'lodash-es';
import normalizeUrl from 'normalize-url';
import { config } from '../config';
import WordPressService from './wordpress-service';

const CACHE_TTL_MS = 60 * 60 * 1000;

type WordPressClient = InstanceType<typeof WordPressService>;

interface RawSkin {
  title: string;
  category: string;
  keywords: string;
  demo_url?: string;
}

interface GetSkinsResponse {
  active_skin?: string;
  skins: Record<string, RawSkin>;
}

interface Language {
  locale: string;
  english_name: string;
  native_name: string;
}

interface GetLanguagesResponse {
  active_locale?: string;
  languages: Language[];
}

export interface Skin {
  slug: string;
  title: string;
  category: string | null;
  keywords: string | null;
  demo_url: string | null;
}

interface CacheEntry {
  value: unknown;
  expiry: number;
}

class BaseSiteService {
  private readonly wp: WordPressClient;
  private readonly cache = new Map<string, CacheEntry>();

  constructor() {
    this.wp = new WordPressService(config.baseSite.url, {
      username: config.baseSite.username,
      password: config.baseSite.appPassword!,
    });
  }

  async getSkins(): Promise<Skin[]> {
    const data: GetSkinsResponse = await this.wp.requestRaw('trx-waas-wizard/v1/get-skins');
    return map(data.skins, (skin, slug) => ({
      slug,
      title: skin.title,
      category: skin.category || null,
      keywords: skin.keywords || null,
      demo_url: !isNil(skin.demo_url)
        ? normalizeUrl(skin.demo_url, { defaultProtocol: 'https', removeTrailingSlash: true })
        : null,
    }));
  }

  async getLanguages(): Promise<Language[]> {
    const data: GetLanguagesResponse = await this.wp.requestRaw('trx-waas-wizard/v1/save-wizard-data/languages');
    return get(data, 'languages', []);
  }
}

export default BaseSiteService;
