-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "api_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key" varchar(70) NOT NULL,
	"client_id" varchar(100) NOT NULL,
	"client_name" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"revoked" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone,
	CONSTRAINT "api_keys_api_key_key" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "site_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"api_key_id" uuid,
	"site_url" varchar(500) NOT NULL,
	"plugin_version" varchar(20),
	"wp_version" varchar(20),
	"php_version" varchar(20),
	"active_theme" varchar(255),
	"registered_at" timestamp with time zone DEFAULT now(),
	"last_heartbeat" timestamp with time zone,
	"status" varchar(20) DEFAULT 'active',
	"site_health" jsonb DEFAULT '{}'::jsonb,
	CONSTRAINT "site_registrations_api_key_id_site_url_key" UNIQUE("api_key_id","site_url")
);
--> statement-breakpoint
CREATE TABLE "plugin_traffic_data" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"registration_id" uuid,
	"visit_time" timestamp with time zone NOT NULL,
	"visitor_type" varchar(20),
	"bot_name" varchar(100),
	"bot_company" varchar(100),
	"page_url" varchar(500),
	"confidence" smallint,
	"synced_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "plugin_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"config_value" jsonb NOT NULL,
	"version" varchar(20) DEFAULT '1.0.0',
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "plugin_configs_config_key_key" UNIQUE("config_key")
);
--> statement-breakpoint
CREATE TABLE "agent_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"registration_id" uuid,
	"action_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"result" jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"delivered_at" timestamp with time zone,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_subscription_id" text NOT NULL,
	"stripe_price_id" text NOT NULL,
	"plan_tier" text NOT NULL,
	"status" text NOT NULL,
	"current_period_end" timestamp with time zone,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "proxy_request_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"site_id" uuid,
	"domain" varchar(500),
	"model" varchar(60),
	"endpoint" varchar(100),
	"method" varchar(10),
	"prompt_tokens" integer DEFAULT 0,
	"completion_tokens" integer DEFAULT 0,
	"total_tokens" integer DEFAULT 0,
	"response_status" integer,
	"latency_ms" integer,
	"error_message" text,
	"requested_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "proxy_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"domain" varchar(500) NOT NULL,
	"api_key" varchar(80) NOT NULL,
	"label" varchar(255),
	"status" varchar(20) DEFAULT 'active',
	"monthly_token_limit" bigint DEFAULT 100000,
	"created_at" timestamp with time zone DEFAULT now(),
	"revoked_at" timestamp with time zone,
	"wp_url" varchar(500),
	CONSTRAINT "proxy_sites_domain_key" UNIQUE("domain"),
	CONSTRAINT "proxy_sites_api_key_key" UNIQUE("api_key")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text,
	"plan_tier" text DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_key" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "domain_registrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site_id" uuid,
	"domain" text NOT NULL,
	"namecheap_order_id" text,
	"registered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"used_plan_credit" boolean DEFAULT true NOT NULL,
	"stripe_payment_intent_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" text DEFAULT 'registered' NOT NULL,
	"stripe_checkout_session_id" text,
	"error_message" text,
	"total_charged_cents" integer,
	"wholesale_cents" integer
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_key" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "billing_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"stripe_event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "billing_events_stripe_event_id_key" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
CREATE TABLE "user_sites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"domain" text,
	"instawp_id" text,
	"template_slug" text,
	"wp_url" text,
	"wp_username" text,
	"wp_password" text,
	"site_name" text,
	"status" text DEFAULT 'active' NOT NULL,
	"onboard_type" text,
	"onboard_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"image_bank_login" text,
	"image_bank_password" text,
	"images_status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"site_id" uuid NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "editor_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "editor_messages_role_check" CHECK (role = ANY (ARRAY['user'::text, 'assistant'::text, 'system'::text]))
);
--> statement-breakpoint
ALTER TABLE "site_registrations" ADD CONSTRAINT "site_registrations_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugin_traffic_data" ADD CONSTRAINT "plugin_traffic_data_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."site_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_actions" ADD CONSTRAINT "agent_actions_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "public"."site_registrations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proxy_request_log" ADD CONSTRAINT "proxy_request_log_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."proxy_sites"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_registrations" ADD CONSTRAINT "domain_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_registrations" ADD CONSTRAINT "domain_registrations_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."user_sites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sites" ADD CONSTRAINT "user_sites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_sessions" ADD CONSTRAINT "editor_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_sessions" ADD CONSTRAINT "editor_sessions_site_id_fkey" FOREIGN KEY ("site_id") REFERENCES "public"."user_sites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_messages" ADD CONSTRAINT "editor_messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "public"."editor_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_api_keys_api_key" ON "api_keys" USING btree ("api_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_api_keys_client_id" ON "api_keys" USING btree ("client_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_site_registrations_status" ON "site_registrations" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_plugin_traffic_registration" ON "plugin_traffic_data" USING btree ("registration_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_plugin_traffic_visit_time" ON "plugin_traffic_data" USING btree ("visit_time" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_actions_registration" ON "agent_actions" USING btree ("registration_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_agent_actions_status" ON "agent_actions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "subscriptions" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_stripe_id" ON "subscriptions" USING btree ("stripe_subscription_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_proxy_request_log_domain" ON "proxy_request_log" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_proxy_request_log_requested_at" ON "proxy_request_log" USING btree ("requested_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_proxy_request_log_site_id" ON "proxy_request_log" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_proxy_sites_api_key" ON "proxy_sites" USING btree ("api_key" text_ops);--> statement-breakpoint
CREATE INDEX "idx_proxy_sites_domain" ON "proxy_sites" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_proxy_sites_status" ON "proxy_sites" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_users_email" ON "users" USING btree ("email" text_ops);--> statement-breakpoint
CREATE INDEX "idx_domain_registrations_domain" ON "domain_registrations" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_domain_registrations_expires_at" ON "domain_registrations" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_domain_registrations_session_id" ON "domain_registrations" USING btree ("stripe_checkout_session_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_domain_registrations_status" ON "domain_registrations" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_domain_registrations_user_id" ON "domain_registrations" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_expires_at" ON "user_sessions" USING btree ("expires_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_token" ON "user_sessions" USING btree ("token" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_billing_events_type" ON "billing_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sites_domain" ON "user_sites" USING btree ("domain" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sites_status" ON "user_sites" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_user_sites_user_id" ON "user_sites" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_editor_sessions_site_id" ON "editor_sessions" USING btree ("site_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_editor_sessions_user_id" ON "editor_sessions" USING btree ("user_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_editor_messages_session_id" ON "editor_messages" USING btree ("session_id" uuid_ops);
*/