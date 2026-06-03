import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { eq, lte, sql } from 'drizzle-orm';
import { db, users, userSessions } from '../db/client';
import { config } from '../config';

interface UpdateProfileInput {
  displayName?: string;
}

interface SessionMeta {
  userAgent?: string;
  ipAddress?: string;
}

type ValidateSessionRow = {
  id: string;
  token: string;
  expires_at: string;
  user_id: string;
  email: string;
  display_name: string | null;
  plan_tier: string;
  status: string;
} & Record<string, unknown>;

export default class AuthService {

  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  // ==========================================
  // REGISTRATION & LOGIN
  // ==========================================

  async register(email: string, password: string, displayName?: string) {
    await this.initialize();

    const normalizedEmail = email.toLowerCase().trim();

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, normalizedEmail));

    if (existing.length > 0) {
      throw Object.assign(new Error('Email already registered'), { code: 'EMAIL_EXISTS' });
    }

    const passwordHash = await bcrypt.hash(password, config.auth.bcryptRounds);

    const result = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        passwordHash,
        displayName: displayName || null,
      })
      .returning({
        id: users.id,
        email: users.email,
        display_name: users.displayName,
        plan_tier: users.planTier,
        status: users.status,
        created_at: users.createdAt,
      });

    return result[0];
  }

  async login(email: string, password: string) {
    await this.initialize();

    const normalizedEmail = email.toLowerCase().trim();

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        password_hash: users.passwordHash,
        display_name: users.displayName,
        plan_tier: users.planTier,
        stripe_customer_id: users.stripeCustomerId,
        status: users.status,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
      })
      .from(users)
      .where(eq(users.email, normalizedEmail));

    const user = result[0];
    if (!user) {
      throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });
    }

    if (user.status !== 'active') {
      throw Object.assign(new Error('Account is disabled'), { code: 'ACCOUNT_DISABLED' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw Object.assign(new Error('Invalid email or password'), { code: 'INVALID_CREDENTIALS' });
    }

    const { password_hash, ...safeUser } = user;
    return safeUser;
  }

  // ==========================================
  // SESSION MANAGEMENT
  // ==========================================

  async createSession(userId: string, meta: SessionMeta = {}) {
    await this.initialize();

    const token = crypto.randomBytes(64).toString('hex');
    const expiresAt = new Date(Date.now() + config.auth.sessionMaxAge);

    await db.insert(userSessions).values({
      userId,
      token,
      userAgent: meta.userAgent || null,
      ipAddress: meta.ipAddress || null,
      expiresAt: expiresAt.toISOString(),
    });

    return { token, expiresAt };
  }

  async validateSession(token: string) {
    await this.initialize();

    const { rows } = await db.execute<ValidateSessionRow>(sql`
      SELECT s.*, u.id AS user_id, u.email, u.display_name, u.plan_tier, u.status
      FROM user_sessions s
      JOIN users u ON u.id = s.user_id
      WHERE s.token = ${token} AND s.expires_at > NOW() AND u.status = 'active'
    `);

    if (!rows[0]) return null;

    const row = rows[0];
    return {
      session: {
        id: row.id,
        token: row.token,
        expiresAt: row.expires_at,
      },
      user: {
        id: row.user_id,
        email: row.email,
        displayName: row.display_name,
        planTier: row.plan_tier,
        status: row.status,
      },
    };
  }

  async deleteSession(token: string) {
    await this.initialize();
    await db.delete(userSessions).where(eq(userSessions.token, token));
  }

  async deleteAllUserSessions(userId: string) {
    await this.initialize();
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }

  async cleanExpiredSessions() {
    await this.initialize();
    const result = await db.delete(userSessions).where(lte(userSessions.expiresAt, sql`NOW()`));
    return result.rowCount;
  }

  // ==========================================
  // USER MANAGEMENT
  // ==========================================

  async getUserById(userId: string) {
    await this.initialize();

    const result = await db
      .select({
        id: users.id,
        email: users.email,
        display_name: users.displayName,
        plan_tier: users.planTier,
        status: users.status,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
      })
      .from(users)
      .where(eq(users.id, userId));

    return result[0] || null;
  }

  async updatePassword(userId: string, currentPassword: string, newPassword: string) {
    await this.initialize();

    const result = await db
      .select({ password_hash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId));

    if (!result[0]) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const valid = await bcrypt.compare(currentPassword, result[0].password_hash);
    if (!valid) {
      throw Object.assign(new Error('Current password is incorrect'), { code: 'INVALID_PASSWORD' });
    }

    const passwordHash = await bcrypt.hash(newPassword, config.auth.bcryptRounds);
    await db
      .update(users)
      .set({ passwordHash, updatedAt: sql`NOW()` })
      .where(eq(users.id, userId));
  }

  async updateProfile(userId: string, updates: UpdateProfileInput) {
    await this.initialize();

    const allowed: { displayName?: string | null } = {};
    if (updates.displayName !== undefined) allowed.displayName = updates.displayName;

    const keys = Object.keys(allowed);
    if (keys.length === 0) return this.getUserById(userId);

    const result = await db
      .update(users)
      .set({ ...allowed, updatedAt: sql`NOW()` })
      .where(eq(users.id, userId))
      .returning({
        id: users.id,
        email: users.email,
        display_name: users.displayName,
        plan_tier: users.planTier,
        status: users.status,
        created_at: users.createdAt,
        updated_at: users.updatedAt,
      });

    return result[0] || null;
  }

  async deleteUser(userId: string, password: string) {
    await this.initialize();

    const result = await db
      .select({ password_hash: users.passwordHash })
      .from(users)
      .where(eq(users.id, userId));

    if (!result[0]) {
      throw Object.assign(new Error('User not found'), { code: 'NOT_FOUND' });
    }

    const valid = await bcrypt.compare(password, result[0].password_hash);
    if (!valid) {
      throw Object.assign(new Error('Password is incorrect'), { code: 'INVALID_PASSWORD' });
    }

    await db.delete(users).where(eq(users.id, userId));
  }
}
