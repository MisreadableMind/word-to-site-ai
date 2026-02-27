import { config } from '../config.js';

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

class SkinsService {
  constructor() {
    const { url, username, appPassword } = config.waasBaseSite;
    this.baseUrl = url.replace(/\/+$/, '');
    const cleanPassword = (appPassword || '').replace(/ /g, '');
    this.authHeader = username && cleanPassword
      ? 'Basic ' + Buffer.from(`${username}:${cleanPassword}`).toString('base64')
      : null;
    this.cache = { skins: null, languages: null };
  }

  async getSkins() {
    if (this.cache.skins && Date.now() - this.cache.skins.time < CACHE_TTL) {
      return this.cache.skins.data;
    }
    const data = await this._fetch('/wp-json/trx-waas-wizard/v1/get-skins');
    this.cache.skins = { data, time: Date.now() };
    return data;
  }

  async getLanguages() {
    if (this.cache.languages && Date.now() - this.cache.languages.time < CACHE_TTL) {
      return this.cache.languages.data;
    }
    const data = await this._fetch('/wp-json/trx-waas-wizard/v1/save-wizard-data/languages');
    this.cache.languages = { data, time: Date.now() };
    return data;
  }

  async _fetch(path) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.authHeader) {
      headers['Authorization'] = this.authHeader;
    }
    const res = await fetch(`${this.baseUrl}${path}`, { headers });
    if (!res.ok) {
      throw new Error(`WaaS API error: ${res.status} ${res.statusText}`);
    }
    return res.json();
  }
}

export default SkinsService;
