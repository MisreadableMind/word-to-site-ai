import randomstring from "randomstring";
import { and, eq, ne, sql } from "drizzle-orm";
import { db, siteLicenses, userSites, users } from "../db/client";

export type PersistableLicenseStatus = "active" | "expired" | "not_paid" | "disabled";

export enum LicenseStatus {
  Active = "active",
  Expired = "expired",
  NotPaid = "not_paid",
  Disabled = "disabled",
  NotFound = "not_found",
}

const PERSISTABLE_STATUSES: readonly PersistableLicenseStatus[] = ["active", "expired", "not_paid", "disabled"];

function isPersistableStatus(value: string): value is PersistableLicenseStatus {
  return (PERSISTABLE_STATUSES as readonly string[]).includes(value);
}

function hex(length: number): string {
  return randomstring.generate({ length, charset: "hex", capitalization: "lowercase" });
}

export function generateLicenseKey(): string {
  return `WaaS-${hex(4)}-${hex(4)}-4${hex(3)}-${hex(4)}-${hex(12)}`;
}

export const LICENSE_KEY_REGEX = /^WaaS-[0-9a-f]{4}-[0-9a-f]{4}-4[0-9a-f]{3}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isValidLicenseKeyFormat(key: string): boolean {
  return typeof key === "string" && LICENSE_KEY_REGEX.test(key);
}

const LICENSE_TERM_DAYS = 365;

function defaultExpiry(): string {
  return new Date(Date.now() + LICENSE_TERM_DAYS * 86400000).toISOString();
}

const licenseColumns = {
  id: siteLicenses.id,
  license_key: siteLicenses.licenseKey,
  instawp_id: siteLicenses.instawpId,
  user_site_id: siteLicenses.userSiteId,
  user_id: siteLicenses.userId,
  wp_url: siteLicenses.wpUrl,
  status: siteLicenses.status,
  expires_at: siteLicenses.expiresAt,
  activated_at: siteLicenses.activatedAt,
  created_at: siteLicenses.createdAt,
  updated_at: siteLicenses.updatedAt,
};

interface IssueSiteLicenseInput {
  instawpId: string;
  wpUrl: string | null;
  userId: string | null;
  userSiteId: string | null;
  status: PersistableLicenseStatus;
  licenseKey: string;
}

interface LinkSiteLicenseInput {
  instawpId: string;
  userId: string;
  userSiteId: string;
}

interface ResolvableLicenseRow {
  status: string;
  expires_at: string | null;
  site_status: string | null;
}

export default class LicenseService {
  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async issueForSite(input: IssueSiteLicenseInput) {
    await this.initialize();

    await db
      .insert(siteLicenses)
      .values({
        licenseKey: input.licenseKey,
        instawpId: input.instawpId,
        wpUrl: input.wpUrl,
        userId: input.userId,
        userSiteId: input.userSiteId,
        status: input.status,
        expiresAt: defaultExpiry(),
      })
      .onConflictDoNothing({ target: siteLicenses.instawpId });

    const [row] = await db
      .select(licenseColumns)
      .from(siteLicenses)
      .where(eq(siteLicenses.instawpId, input.instawpId))
      .limit(1);

    return row || null;
  }

  async linkSite(input: LinkSiteLicenseInput) {
    await this.initialize();

    const [row] = await db
      .update(siteLicenses)
      .set({ userId: input.userId, userSiteId: input.userSiteId, updatedAt: sql`now()` })
      .where(eq(siteLicenses.instawpId, input.instawpId))
      .returning(licenseColumns);

    return row || null;
  }

  resolveStatus(row: ResolvableLicenseRow | null): LicenseStatus {
    if (!row) return LicenseStatus.NotFound;
    if (row.site_status === "deleted") return LicenseStatus.NotFound;
    if (row.status === LicenseStatus.Disabled) return LicenseStatus.Disabled;
    if (row.status === LicenseStatus.NotPaid) return LicenseStatus.NotPaid;
    if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) return LicenseStatus.Expired;
    if (row.status === LicenseStatus.Expired) return LicenseStatus.Expired;
    if (row.status === LicenseStatus.Active) return LicenseStatus.Active;
    return LicenseStatus.NotFound;
  }

  async checkLicense(code: string) {
    if (!isValidLicenseKeyFormat(code)) {
      return { found: false as const };
    }
    await this.initialize();

    const [row] = await db
      .select({
        status: siteLicenses.status,
        created_at: siteLicenses.createdAt,
        expires_at: siteLicenses.expiresAt,
        user_name: users.displayName,
        site_status: userSites.status,
      })
      .from(siteLicenses)
      .leftJoin(users, eq(siteLicenses.userId, users.id))
      .leftJoin(userSites, eq(siteLicenses.userSiteId, userSites.id))
      .where(eq(siteLicenses.licenseKey, code))
      .limit(1);

    if (!row || row.site_status === "deleted") {
      return { found: false as const };
    }

    const status = this.resolveStatus({ status: row.status, expires_at: row.expires_at, site_status: row.site_status });
    if (status !== LicenseStatus.Active) {
      return { found: true as const, status };
    }

    return {
      found: true as const,
      status: LicenseStatus.Active,
      createdAt: row.created_at,
      userName: row.user_name,
      supportedUntil: row.expires_at,
    };
  }

  async setStatus(key: string, status: string) {
    if (!isPersistableStatus(status)) {
      return { ok: false as const, reason: "invalid_status" as const };
    }
    await this.initialize();

    const [row] = await db
      .update(siteLicenses)
      .set({ status, updatedAt: sql`now()` })
      .where(eq(siteLicenses.licenseKey, key))
      .returning({ id: siteLicenses.id, status: siteLicenses.status });

    if (!row) return { ok: false as const, reason: "not_found" as const };
    return { ok: true as const, status: row.status };
  }

  async markActivated(key: string) {
    await this.initialize();

    const [row] = await db
      .update(siteLicenses)
      .set({ activatedAt: sql`now()`, updatedAt: sql`now()` })
      .where(eq(siteLicenses.licenseKey, key))
      .returning({ id: siteLicenses.id, activated_at: siteLicenses.activatedAt });

    return row || null;
  }

  async syncFromBilling(userId: string, status: string, expiresAt: string | null = null) {
    if (!isPersistableStatus(status)) return;
    await this.initialize();

    if (expiresAt) {
      await db
        .update(siteLicenses)
        .set({ status, expiresAt, updatedAt: sql`now()` })
        .where(and(eq(siteLicenses.userId, userId), ne(siteLicenses.status, "disabled")));
      return;
    }

    await db
      .update(siteLicenses)
      .set({ status, updatedAt: sql`now()` })
      .where(and(eq(siteLicenses.userId, userId), ne(siteLicenses.status, "disabled")));
  }
}
