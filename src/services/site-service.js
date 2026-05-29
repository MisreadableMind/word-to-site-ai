import pool from '../db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import InstaWPAPI from '../instawp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class SiteService {

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      const migration004 = path.join(__dirname, '../db/migrations/004-user-sites.sql');
      const migration007 = path.join(__dirname, '../db/migrations/007-site-image-bank.sql');
      await pool.query(fs.readFileSync(migration004, 'utf-8'));
      await pool.query(fs.readFileSync(migration007, 'utf-8'));
      this.initialized = true;
      console.log('User sites database initialized');
    } catch (error) {
      console.error('Failed to initialize user sites database:', error.message);
    }
  }

  // ==========================================
  // CRUD
  // ==========================================

  async createSite(userId, data) {
    await this.initialize();

    const result = await pool.query(
      `INSERT INTO user_sites (
         user_id, domain, instawp_id, template_slug, wp_url, wp_username, wp_password,
         site_name, onboard_type, onboard_data,
         image_bank_login, image_bank_password, images_status
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, 'pending'))
       RETURNING *`,
      [
        userId,
        data.domain || null,
        data.instawpId || null,
        data.templateSlug || null,
        data.wpUrl || null,
        data.wpUsername || null,
        data.wpPassword || null,
        data.siteName || null,
        data.onboardType || null,
        data.onboardData ? JSON.stringify(data.onboardData) : null,
        data.imageBankLogin || null,
        data.imageBankPassword || null,
        data.imagesStatus || null,
      ]
    );

    return result.rows[0];
  }

  async setImagesStatusByImageBankLogin(login, status) {
    await this.initialize();
    const result = await pool.query(
      `UPDATE user_sites SET images_status = $1, updated_at = NOW()
       WHERE image_bank_login = $2 AND status != 'deleted'
       RETURNING *`,
      [status, login]
    );
    return result.rows[0] || null;
  }

  async findImageBankCredsByWpUrl(wpUrl) {
    if (!wpUrl) return null;
    await this.initialize();
    const result = await pool.query(
      `SELECT image_bank_login, image_bank_password
       FROM user_sites
       WHERE wp_url = $1
         AND image_bank_login IS NOT NULL
         AND image_bank_password IS NOT NULL
         AND status != 'deleted'
       ORDER BY created_at DESC
       LIMIT 1`,
      [wpUrl]
    );
    const row = result.rows[0];
    return row ? { login: row.image_bank_login, password: row.image_bank_password } : null;
  }

  async listSites(userId) {
    await this.initialize();

    const result = await pool.query(
      `SELECT id, user_id, domain, instawp_id, template_slug, wp_url, site_name, status, onboard_type, created_at, updated_at
       FROM user_sites
       WHERE user_id = $1 AND status != 'deleted'
       ORDER BY created_at DESC`,
      [userId]
    );

    return result.rows;
  }

  async getSiteById(siteId, userId) {
    await this.initialize();

    const result = await pool.query(
      'SELECT * FROM user_sites WHERE id = $1 AND user_id = $2',
      [siteId, userId]
    );

    return result.rows[0] || null;
  }

  async updateSite(siteId, userId, updates) {
    await this.initialize();

    const allowed = {};
    if (updates.siteName !== undefined) allowed.site_name = updates.siteName;
    if (updates.domain !== undefined) allowed.domain = updates.domain;
    if (updates.status !== undefined) allowed.status = updates.status;

    const keys = Object.keys(allowed);
    if (keys.length === 0) return this.getSiteById(siteId, userId);

    const setClauses = keys.map((k, i) => `${k} = $${i + 3}`);
    setClauses.push('updated_at = NOW()');
    const values = keys.map(k => allowed[k]);

    const result = await pool.query(
      `UPDATE user_sites SET ${setClauses.join(', ')} WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [siteId, userId, ...values]
    );

    return result.rows[0] || null;
  }

  async deleteSite(siteId, userId) {
    await this.initialize();

    const result = await pool.query(
      `UPDATE user_sites SET status = 'deleted', updated_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [siteId, userId]
    );

    const site = result.rows[0] || null;

    if (site && site.instawp_id) {
      try {
        await new InstaWPAPI().deleteSite(site.instawp_id);
      } catch (error) {
        console.error(`Failed to delete InstaWP site ${site.instawp_id}:`, error.message);
      }
    }

    return site;
  }
}
