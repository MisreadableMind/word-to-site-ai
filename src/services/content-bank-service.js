import { config } from '../config.js';

const CONTENT_BANK_BASE_URL = 'https://content-bank.themerex.net';

export default class ContentBankService {
  constructor(options = {}) {
    this.baseUrl = options.baseUrl || CONTENT_BANK_BASE_URL;
    this.adminLogin = options.adminLogin || config.imageBank.login;
    this.adminPassword = options.adminPassword || config.imageBank.password;
  }

  get enabled() {
    return Boolean(this.adminLogin && this.adminPassword);
  }

  get authHeader() {
    const credentials = Buffer.from(`${this.adminLogin}:${this.adminPassword}`).toString('base64');
    return `Basic ${credentials}`;
  }

  async createUser({ domain, name, email, role = 'user' }) {
    if (!this.enabled) {
      throw new Error('IMAGE_BANK_LOGIN / IMAGE_BANK_PASSWORD are not configured');
    }
    if (!domain) {
      throw new Error('domain is required to create a content bank user');
    }

    const body = { domain, role };
    if (name) body.name = name;
    if (email) body.email = email;

    const response = await fetch(`${this.baseUrl}/api/users`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload?.success === false) {
      const message = payload?.error || `${response.status} ${response.statusText}`;
      const err = new Error(`Content bank createUser failed: ${message}`);
      err.status = response.status;
      throw err;
    }

    const data = payload.data || {};
    if (!data.login || !data.password) {
      throw new Error('Content bank createUser response missing login/password');
    }
    return { login: data.login, password: data.password };
  }
}
