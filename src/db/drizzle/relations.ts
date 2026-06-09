import { relations } from "drizzle-orm/relations";
import { apiKeys, siteRegistrations, pluginTrafficData, agentActions, users, subscriptions, proxySites, proxyRequestLog, domainRegistrations, userSites, userSessions, editorSessions, editorMessages, siteLicenses } from "./schema";

export const siteRegistrationsRelations = relations(siteRegistrations, ({one, many}) => ({
	apiKey: one(apiKeys, {
		fields: [siteRegistrations.apiKeyId],
		references: [apiKeys.id]
	}),
	pluginTrafficData: many(pluginTrafficData),
	agentActions: many(agentActions),
}));

export const apiKeysRelations = relations(apiKeys, ({many}) => ({
	siteRegistrations: many(siteRegistrations),
}));

export const pluginTrafficDataRelations = relations(pluginTrafficData, ({one}) => ({
	siteRegistration: one(siteRegistrations, {
		fields: [pluginTrafficData.registrationId],
		references: [siteRegistrations.id]
	}),
}));

export const agentActionsRelations = relations(agentActions, ({one}) => ({
	siteRegistration: one(siteRegistrations, {
		fields: [agentActions.registrationId],
		references: [siteRegistrations.id]
	}),
}));

export const subscriptionsRelations = relations(subscriptions, ({one}) => ({
	user: one(users, {
		fields: [subscriptions.userId],
		references: [users.id]
	}),
}));

export const usersRelations = relations(users, ({many}) => ({
	subscriptions: many(subscriptions),
	domainRegistrations: many(domainRegistrations),
	userSessions: many(userSessions),
	userSites: many(userSites),
	editorSessions: many(editorSessions),
	siteLicenses: many(siteLicenses),
}));

export const siteLicensesRelations = relations(siteLicenses, ({one}) => ({
	user: one(users, {
		fields: [siteLicenses.userId],
		references: [users.id]
	}),
	userSite: one(userSites, {
		fields: [siteLicenses.userSiteId],
		references: [userSites.id]
	}),
}));

export const proxyRequestLogRelations = relations(proxyRequestLog, ({one}) => ({
	proxySite: one(proxySites, {
		fields: [proxyRequestLog.siteId],
		references: [proxySites.id]
	}),
}));

export const proxySitesRelations = relations(proxySites, ({many}) => ({
	proxyRequestLogs: many(proxyRequestLog),
}));

export const domainRegistrationsRelations = relations(domainRegistrations, ({one}) => ({
	user: one(users, {
		fields: [domainRegistrations.userId],
		references: [users.id]
	}),
	userSite: one(userSites, {
		fields: [domainRegistrations.siteId],
		references: [userSites.id]
	}),
}));

export const userSitesRelations = relations(userSites, ({one, many}) => ({
	domainRegistrations: many(domainRegistrations),
	user: one(users, {
		fields: [userSites.userId],
		references: [users.id]
	}),
	editorSessions: many(editorSessions),
	siteLicenses: many(siteLicenses),
}));

export const userSessionsRelations = relations(userSessions, ({one}) => ({
	user: one(users, {
		fields: [userSessions.userId],
		references: [users.id]
	}),
}));

export const editorSessionsRelations = relations(editorSessions, ({one, many}) => ({
	user: one(users, {
		fields: [editorSessions.userId],
		references: [users.id]
	}),
	userSite: one(userSites, {
		fields: [editorSessions.siteId],
		references: [userSites.id]
	}),
	editorMessages: many(editorMessages),
}));

export const editorMessagesRelations = relations(editorMessages, ({one}) => ({
	editorSession: one(editorSessions, {
		fields: [editorMessages.sessionId],
		references: [editorSessions.id]
	}),
}));