import { and, desc, eq, isNotNull, ne, sql } from "drizzle-orm";
import { db, userSites } from "../db/client";
import InstaWPAPI from "../instawp";

const fullSiteColumns = {
  id: userSites.id,
  user_id: userSites.userId,
  domain: userSites.domain,
  instawp_id: userSites.instawpId,
  template_slug: userSites.templateSlug,
  wp_url: userSites.wpUrl,
  wp_username: userSites.wpUsername,
  wp_password: userSites.wpPassword,
  site_name: userSites.siteName,
  status: userSites.status,
  onboard_type: userSites.onboardType,
  onboard_data: userSites.onboardData,
  created_at: userSites.createdAt,
  updated_at: userSites.updatedAt,
  image_bank_login: userSites.imageBankLogin,
  image_bank_password: userSites.imageBankPassword,
  images_status: userSites.imagesStatus,
};

interface CreateSiteData {
  domain: string | null;
  instawpId: string | null;
  templateSlug: string | null;
  wpUrl: string | null;
  wpUsername: string | null;
  wpPassword: string | null;
  siteName: string | null;
  onboardType: string | null;
  onboardData: unknown;
  imageBankLogin: string | null;
  imageBankPassword: string | null;
  imagesStatus: string | null;
}

interface UpdateSiteData {
  siteName: string;
  domain: string | null;
  status: string;
}

export default class SiteService {
  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async createSite(userId: string, data: Partial<CreateSiteData>) {
    await this.initialize();

    const [row] = await db
      .insert(userSites)
      .values({
        userId,
        domain: data.domain || null,
        instawpId: data.instawpId || null,
        templateSlug: data.templateSlug || null,
        wpUrl: data.wpUrl || null,
        wpUsername: data.wpUsername || null,
        wpPassword: data.wpPassword || null,
        siteName: data.siteName || null,
        onboardType: data.onboardType || null,
        onboardData: data.onboardData || null,
        imageBankLogin: data.imageBankLogin || null,
        imageBankPassword: data.imageBankPassword || null,
        imagesStatus: data.imagesStatus || "pending",
      })
      .returning(fullSiteColumns);

    return row;
  }

  async setImagesStatusByImageBankLogin(login: string, status: string) {
    await this.initialize();

    const [row] = await db
      .update(userSites)
      .set({ imagesStatus: status, updatedAt: sql`now()` })
      .where(and(eq(userSites.imageBankLogin, login), ne(userSites.status, "deleted")))
      .returning(fullSiteColumns);

    return row || null;
  }

  async findImageBankCredsByWpUrl(wpUrl: string | null) {
    if (!wpUrl) return null;
    await this.initialize();

    const [row] = await db
      .select({
        image_bank_login: userSites.imageBankLogin,
        image_bank_password: userSites.imageBankPassword,
      })
      .from(userSites)
      .where(
        and(
          eq(userSites.wpUrl, wpUrl),
          isNotNull(userSites.imageBankLogin),
          isNotNull(userSites.imageBankPassword),
          ne(userSites.status, "deleted"),
        ),
      )
      .orderBy(desc(userSites.createdAt))
      .limit(1);

    return row ? { login: row.image_bank_login, password: row.image_bank_password } : null;
  }

  async listSites(userId: string) {
    await this.initialize();

    const rows = await db
      .select({
        id: userSites.id,
        user_id: userSites.userId,
        domain: userSites.domain,
        instawp_id: userSites.instawpId,
        template_slug: userSites.templateSlug,
        wp_url: userSites.wpUrl,
        site_name: userSites.siteName,
        status: userSites.status,
        onboard_type: userSites.onboardType,
        created_at: userSites.createdAt,
        updated_at: userSites.updatedAt,
      })
      .from(userSites)
      .where(and(eq(userSites.userId, userId), ne(userSites.status, "deleted")))
      .orderBy(desc(userSites.createdAt));

    return rows;
  }

  async getSiteById(siteId: string, userId: string) {
    await this.initialize();

    const [row] = await db
      .select(fullSiteColumns)
      .from(userSites)
      .where(and(eq(userSites.id, siteId), eq(userSites.userId, userId)))
      .limit(1);

    return row || null;
  }

  async updateSite(siteId: string, userId: string, updates: Partial<UpdateSiteData>) {
    await this.initialize();

    const allowed: { siteName?: string; domain?: string | null; status?: string } = {};
    if (updates.siteName !== undefined) allowed.siteName = updates.siteName;
    if (updates.domain !== undefined) allowed.domain = updates.domain;
    if (updates.status !== undefined) allowed.status = updates.status;

    if (Object.keys(allowed).length === 0) return this.getSiteById(siteId, userId);

    const [row] = await db
      .update(userSites)
      .set({ ...allowed, updatedAt: sql`now()` })
      .where(and(eq(userSites.id, siteId), eq(userSites.userId, userId)))
      .returning(fullSiteColumns);

    return row || null;
  }

  async deleteSite(siteId: string, userId: string) {
    await this.initialize();

    const [row] = await db
      .update(userSites)
      .set({ status: "deleted", updatedAt: sql`now()` })
      .where(and(eq(userSites.id, siteId), eq(userSites.userId, userId)))
      .returning(fullSiteColumns);

    const site = row || null;

    if (site && site.instawp_id) {
      try {
        await new InstaWPAPI().deleteSite(site.instawp_id);
      } catch (error) {
        console.error(
          `Failed to delete InstaWP site ${site.instawp_id}:`,
          error instanceof Error ? error.message : String(error),
        );
      }
    }

    return site;
  }
}
