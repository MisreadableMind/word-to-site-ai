import { sql } from "drizzle-orm";
import { DateTime } from "luxon";
import { db } from "../db/client";
import { getStripe } from "../billing/stripe-client";
import { getIncludedSites, getOverageDayCents } from "../billing/entitlements";

type LicenseStatusValue = "active" | "expired" | "not_paid" | "disabled";

interface BillingServiceLike {
  countBillableLiveSites(userId: string): Promise<number>;
}

interface LicenseServiceLike {
  setSiteLicenseStatusBySite(userSiteId: string, status: LicenseStatusValue): Promise<unknown>;
}

interface JobsServiceDeps {
  billingService: BillingServiceLike;
  licenseService: LicenseServiceLike;
}

interface ExpireResult {
  suspended: number;
}

interface OverageResult {
  usageDate: string;
  usersChecked: number;
  usersOverage: number;
  invoiceItemsCreated: number;
}

type SuspendRow = {
  id: string;
  instawp_id: string | null;
};

type PaidUserRow = {
  user_id: string;
  plan_tier: string;
  stripe_customer_id: string;
};

type UsageDayRow = {
  stripe_invoice_item_id: string | null;
};

export default class JobsService {
  billingService: BillingServiceLike;
  licenseService: LicenseServiceLike;

  constructor({ billingService, licenseService }: JobsServiceDeps) {
    this.billingService = billingService;
    this.licenseService = licenseService;
  }

  async runDaily() {
    const expired = await this.expireFreeSites();
    const overage = await this.accrueOverage();
    return { expired, overage };
  }

  async expireFreeSites(): Promise<ExpireResult> {
    const { rows } = await db.execute<SuspendRow>(sql`
      SELECT s.id, s.instawp_id
      FROM user_sites s
      JOIN users u ON u.id = s.user_id
      WHERE u.plan_tier = 'free'
        AND s.bought_out_at IS NULL
        AND s.status = 'active'
        AND (
          (s.expires_at IS NOT NULL AND s.expires_at < now())
          OR (s.expires_at IS NULL AND s.created_at < now() - interval '7 days')
        )
    `);

    for (const row of rows) {
      await db.execute(sql`
        UPDATE user_sites SET status = 'suspended', updated_at = now() WHERE id = ${row.id}
      `);
      await this.licenseService.setSiteLicenseStatusBySite(row.id, "expired").catch((err: Error) => {
        console.warn(`[jobs] failed to expire license for site ${row.id}:`, err.message);
      });
    }

    if (rows.length > 0) console.log(`[jobs] suspended ${rows.length} expired free site(s)`);
    return { suspended: rows.length };
  }

  async accrueOverage(usageDate: string = DateTime.utc().toISODate() as string): Promise<OverageResult> {
    const { rows: paidUsers } = await db.execute<PaidUserRow>(sql`
      SELECT DISTINCT u.id AS user_id, u.plan_tier, u.stripe_customer_id
      FROM users u
      JOIN subscriptions sub ON sub.user_id = u.id
      WHERE sub.status IN ('active', 'trialing', 'past_due')
        AND u.plan_tier IN ('pro', 'business')
        AND u.stripe_customer_id IS NOT NULL
    `);

    let usersOverage = 0;
    let invoiceItemsCreated = 0;

    for (const u of paidUsers) {
      const live = await this.billingService.countBillableLiveSites(u.user_id);
      const included = getIncludedSites(u.plan_tier);
      const overage = Math.max(0, live - included);
      const perCents = getOverageDayCents(u.plan_tier);
      const amountCents = overage * perCents;

      await db.execute(sql`
        INSERT INTO site_usage_days
          (user_id, usage_date, plan_tier, live_sites, included_sites, overage_sites, per_site_cents, amount_cents)
        VALUES
          (${u.user_id}, ${usageDate}, ${u.plan_tier}, ${live}, ${included}, ${overage}, ${perCents}, ${amountCents})
        ON CONFLICT (user_id, usage_date) DO NOTHING
      `);

      if (overage <= 0) continue;
      usersOverage += 1;

      const { rows: dayRows } = await db.execute<UsageDayRow>(sql`
        SELECT stripe_invoice_item_id FROM site_usage_days
        WHERE user_id = ${u.user_id} AND usage_date = ${usageDate}
      `);
      const existing = dayRows[0];
      if (!existing || existing.stripe_invoice_item_id) continue;

      const start = DateTime.fromISO(usageDate, { zone: "utc" });
      const item = await getStripe().invoiceItems.create(
        {
          customer: u.stripe_customer_id,
          amount: amountCents,
          currency: "usd",
          description: `Extra live sites — ${usageDate} (${overage} × $${(perCents / 100).toFixed(2)}/day)`,
          period: {
            start: Math.floor(start.toSeconds()),
            end: Math.floor(start.plus({ days: 1 }).toSeconds()),
          },
          metadata: { user_id: u.user_id, usage_date: usageDate, overage_sites: String(overage) },
        },
        { idempotencyKey: `wts_overage_${u.user_id}_${usageDate}` },
      );

      await db.execute(sql`
        UPDATE site_usage_days SET stripe_invoice_item_id = ${item.id}
        WHERE user_id = ${u.user_id} AND usage_date = ${usageDate}
      `);
      invoiceItemsCreated += 1;
    }

    if (usersOverage > 0) {
      console.log(`[jobs] overage for ${usageDate}: ${usersOverage} user(s), ${invoiceItemsCreated} invoice item(s)`);
    }
    return { usageDate, usersChecked: paidUsers.length, usersOverage, invoiceItemsCreated };
  }
}
