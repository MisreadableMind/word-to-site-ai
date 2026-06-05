// Hand-maintained schema for Drizzle's typed query layer.
// Source of truth is the SQL migrations in src/db/migrations — do NOT run
// drizzle-kit pull (it would re-introspect timestamps as mode:'string' and
// revert the tstz() ISO typing).
import { pgTable, index, unique, uuid, varchar, jsonb, boolean, foreignKey, bigserial, smallint, text, integer, bigint, check } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"
import { tstz } from "./timestamp"



export const apiKeys = pgTable("api_keys", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	apiKey: varchar("api_key", { length: 70 }).notNull(),
	clientId: varchar("client_id", { length: 100 }).notNull(),
	clientName: varchar("client_name", { length: 255 }),
	metadata: jsonb().default({}),
	revoked: boolean().default(false),
	createdAt: tstz("created_at").default(sql`now()`),
	revokedAt: tstz("revoked_at"),
}, (table) => [
	index("idx_api_keys_api_key").using("btree", table.apiKey.asc().nullsLast().op("text_ops")),
	index("idx_api_keys_client_id").using("btree", table.clientId.asc().nullsLast().op("text_ops")),
	unique("api_keys_api_key_key").on(table.apiKey),
]);

export const siteRegistrations = pgTable("site_registrations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	apiKeyId: uuid("api_key_id"),
	siteUrl: varchar("site_url", { length: 500 }).notNull(),
	pluginVersion: varchar("plugin_version", { length: 20 }),
	wpVersion: varchar("wp_version", { length: 20 }),
	phpVersion: varchar("php_version", { length: 20 }),
	activeTheme: varchar("active_theme", { length: 255 }),
	registeredAt: tstz("registered_at").default(sql`now()`),
	lastHeartbeat: tstz("last_heartbeat"),
	status: varchar({ length: 20 }).default('active'),
	siteHealth: jsonb("site_health").default({}),
}, (table) => [
	index("idx_site_registrations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.apiKeyId],
			foreignColumns: [apiKeys.id],
			name: "site_registrations_api_key_id_fkey"
		}),
	unique("site_registrations_api_key_id_site_url_key").on(table.apiKeyId, table.siteUrl),
]);

export const pluginTrafficData = pgTable("plugin_traffic_data", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	registrationId: uuid("registration_id"),
	visitTime: tstz("visit_time").notNull(),
	visitorType: varchar("visitor_type", { length: 20 }),
	botName: varchar("bot_name", { length: 100 }),
	botCompany: varchar("bot_company", { length: 100 }),
	pageUrl: varchar("page_url", { length: 500 }),
	confidence: smallint(),
	syncedAt: tstz("synced_at").default(sql`now()`),
}, (table) => [
	index("idx_plugin_traffic_registration").using("btree", table.registrationId.asc().nullsLast().op("uuid_ops")),
	index("idx_plugin_traffic_visit_time").using("btree", table.visitTime.asc().nullsLast().op("timestamptz_ops")),
	foreignKey({
			columns: [table.registrationId],
			foreignColumns: [siteRegistrations.id],
			name: "plugin_traffic_data_registration_id_fkey"
		}),
]);

export const pluginConfigs = pgTable("plugin_configs", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	configKey: varchar("config_key", { length: 100 }).notNull(),
	configValue: jsonb("config_value").notNull(),
	version: varchar({ length: 20 }).default('1.0.0'),
	updatedAt: tstz("updated_at").default(sql`now()`),
}, (table) => [
	unique("plugin_configs_config_key_key").on(table.configKey),
]);

export const agentActions = pgTable("agent_actions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	registrationId: uuid("registration_id"),
	actionType: varchar("action_type", { length: 100 }).notNull(),
	payload: jsonb().notNull(),
	status: varchar({ length: 20 }).default('pending'),
	result: jsonb(),
	createdAt: tstz("created_at").default(sql`now()`),
	deliveredAt: tstz("delivered_at"),
	completedAt: tstz("completed_at"),
}, (table) => [
	index("idx_agent_actions_registration").using("btree", table.registrationId.asc().nullsLast().op("uuid_ops")),
	index("idx_agent_actions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.registrationId],
			foreignColumns: [siteRegistrations.id],
			name: "agent_actions_registration_id_fkey"
		}),
]);

export const subscriptions = pgTable("subscriptions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	stripeSubscriptionId: text("stripe_subscription_id").notNull(),
	stripePriceId: text("stripe_price_id").notNull(),
	planTier: text("plan_tier").notNull(),
	status: text().notNull(),
	currentPeriodEnd: tstz("current_period_end"),
	cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
	updatedAt: tstz("updated_at").default(sql`now()`).notNull(),
}, (table) => [
	index("idx_subscriptions_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_subscriptions_stripe_id").using("btree", table.stripeSubscriptionId.asc().nullsLast().op("text_ops")),
	index("idx_subscriptions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "subscriptions_user_id_fkey"
		}).onDelete("cascade"),
	unique("subscriptions_stripe_subscription_id_key").on(table.stripeSubscriptionId),
]);

export const proxyRequestLog = pgTable("proxy_request_log", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	siteId: uuid("site_id"),
	domain: varchar({ length: 500 }),
	model: varchar({ length: 60 }),
	endpoint: varchar({ length: 100 }),
	method: varchar({ length: 10 }),
	promptTokens: integer("prompt_tokens").default(0),
	completionTokens: integer("completion_tokens").default(0),
	totalTokens: integer("total_tokens").default(0),
	responseStatus: integer("response_status"),
	latencyMs: integer("latency_ms"),
	errorMessage: text("error_message"),
	requestedAt: tstz("requested_at").default(sql`now()`),
}, (table) => [
	index("idx_proxy_request_log_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("idx_proxy_request_log_requested_at").using("btree", table.requestedAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_proxy_request_log_site_id").using("btree", table.siteId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [proxySites.id],
			name: "proxy_request_log_site_id_fkey"
		}),
]);

export const proxySites = pgTable("proxy_sites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	domain: varchar({ length: 500 }).notNull(),
	apiKey: varchar("api_key", { length: 80 }).notNull(),
	label: varchar({ length: 255 }),
	status: varchar({ length: 20 }).default('active'),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	monthlyTokenLimit: bigint("monthly_token_limit", { mode: "number" }).default(100000),
	createdAt: tstz("created_at").default(sql`now()`),
	revokedAt: tstz("revoked_at"),
	wpUrl: varchar("wp_url", { length: 500 }),
}, (table) => [
	index("idx_proxy_sites_api_key").using("btree", table.apiKey.asc().nullsLast().op("text_ops")),
	index("idx_proxy_sites_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("idx_proxy_sites_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	unique("proxy_sites_domain_key").on(table.domain),
	unique("proxy_sites_api_key_key").on(table.apiKey),
]);

export const users = pgTable("users", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	email: text().notNull(),
	passwordHash: text("password_hash").notNull(),
	displayName: text("display_name"),
	planTier: text("plan_tier").default('free').notNull(),
	stripeCustomerId: text("stripe_customer_id"),
	status: text().default('active').notNull(),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
	updatedAt: tstz("updated_at").default(sql`now()`).notNull(),
}, (table) => [
	index("idx_users_email").using("btree", table.email.asc().nullsLast().op("text_ops")),
	unique("users_email_key").on(table.email),
]);

export const domainRegistrations = pgTable("domain_registrations", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	siteId: uuid("site_id"),
	domain: text().notNull(),
	namecheapOrderId: text("namecheap_order_id"),
	registeredAt: tstz("registered_at").default(sql`now()`).notNull(),
	expiresAt: tstz("expires_at"),
	usedPlanCredit: boolean("used_plan_credit").default(true).notNull(),
	stripePaymentIntentId: text("stripe_payment_intent_id"),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
	status: text().default('registered').notNull(),
	stripeCheckoutSessionId: text("stripe_checkout_session_id"),
	errorMessage: text("error_message"),
	totalChargedCents: integer("total_charged_cents"),
	wholesaleCents: integer("wholesale_cents"),
}, (table) => [
	index("idx_domain_registrations_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("idx_domain_registrations_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_domain_registrations_session_id").using("btree", table.stripeCheckoutSessionId.asc().nullsLast().op("text_ops")),
	index("idx_domain_registrations_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_domain_registrations_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "domain_registrations_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [userSites.id],
			name: "domain_registrations_site_id_fkey"
		}).onDelete("set null"),
]);

export const userSessions = pgTable("user_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	token: text().notNull(),
	userAgent: text("user_agent"),
	ipAddress: text("ip_address"),
	expiresAt: tstz("expires_at").notNull(),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
}, (table) => [
	index("idx_user_sessions_expires_at").using("btree", table.expiresAt.asc().nullsLast().op("timestamptz_ops")),
	index("idx_user_sessions_token").using("btree", table.token.asc().nullsLast().op("text_ops")),
	index("idx_user_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sessions_user_id_fkey"
		}).onDelete("cascade"),
	unique("user_sessions_token_key").on(table.token),
]);

export const billingEvents = pgTable("billing_events", {
	id: bigserial({ mode: "bigint" }).primaryKey().notNull(),
	stripeEventId: text("stripe_event_id").notNull(),
	eventType: text("event_type").notNull(),
	payload: jsonb().notNull(),
	processedAt: tstz("processed_at").default(sql`now()`).notNull(),
}, (table) => [
	index("idx_billing_events_type").using("btree", table.eventType.asc().nullsLast().op("text_ops")),
	unique("billing_events_stripe_event_id_key").on(table.stripeEventId),
]);

export const userSites = pgTable("user_sites", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	domain: text(),
	instawpId: text("instawp_id"),
	templateSlug: text("template_slug"),
	wpUrl: text("wp_url"),
	wpUsername: text("wp_username"),
	wpPassword: text("wp_password"),
	siteName: text("site_name"),
	status: text().default('active').notNull(),
	onboardType: text("onboard_type"),
	onboardData: jsonb("onboard_data"),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
	updatedAt: tstz("updated_at").default(sql`now()`).notNull(),
	imageBankLogin: text("image_bank_login"),
	imageBankPassword: text("image_bank_password"),
	imagesStatus: text("images_status").default('pending').notNull(),
}, (table) => [
	index("idx_user_sites_domain").using("btree", table.domain.asc().nullsLast().op("text_ops")),
	index("idx_user_sites_status").using("btree", table.status.asc().nullsLast().op("text_ops")),
	index("idx_user_sites_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_sites_user_id_fkey"
		}).onDelete("cascade"),
]);

export const editorSessions = pgTable("editor_sessions", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: uuid("user_id").notNull(),
	siteId: uuid("site_id").notNull(),
	title: text().default('New conversation').notNull(),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
	updatedAt: tstz("updated_at").default(sql`now()`).notNull(),
}, (table) => [
	index("idx_editor_sessions_site_id").using("btree", table.siteId.asc().nullsLast().op("uuid_ops")),
	index("idx_editor_sessions_user_id").using("btree", table.userId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "editor_sessions_user_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.siteId],
			foreignColumns: [userSites.id],
			name: "editor_sessions_site_id_fkey"
		}).onDelete("cascade"),
]);

export const editorMessages = pgTable("editor_messages", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	sessionId: uuid("session_id").notNull(),
	role: text().notNull(),
	content: text().notNull(),
	metadata: jsonb(),
	createdAt: tstz("created_at").default(sql`now()`).notNull(),
}, (table) => [
	index("idx_editor_messages_session_id").using("btree", table.sessionId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.sessionId],
			foreignColumns: [editorSessions.id],
			name: "editor_messages_session_id_fkey"
		}).onDelete("cascade"),
	check("editor_messages_role_check", sql`role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text])`),
]);
