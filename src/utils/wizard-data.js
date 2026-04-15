import { toWpLocale } from '../config.js';

/**
 * Build a flat wizard-data payload from deployment + content contexts.
 * Maps fields to the WaaS Wizard plugin's save-all format.
 *
 * @param {Object} deploymentContext - Deployment context (branding, template, etc.)
 * @param {Object} contentContext - Content context (business, language, etc.)
 * @param {Object} site - Site credentials object ({ wp_username, username, … })
 * @returns {Object} Flat wizard data payload
 */
export function buildWizardData(deploymentContext, contentContext, site) {
  const data = {};

  // Step 1 — Site Settings
  if (deploymentContext?.branding?.siteTitle) data.site_title = deploymentContext.branding.siteTitle;
  if (deploymentContext?.branding?.tagline) data.site_tagline = deploymentContext.branding.tagline;
  if (deploymentContext?.branding?.logoUrl) data.site_logo = deploymentContext.branding.logoUrl;
  if (deploymentContext?.branding?.faviconUrl) data.site_favicon = deploymentContext.branding.faviconUrl;

  // Language — convert ISO 639-1 to WP locale
  const isoLang = contentContext?.language?.primary;
  if (isoLang) {
    data.site_language = toWpLocale(isoLang);
  }

  // Step 2 — User Profile
  const username = site?.wp_username || site?.username;
  if (username) data.username = username;
  if (contentContext?.business?.contactInfo?.email) data.email = contentContext.business.contactInfo.email;

  // Nickname & bio (Step 2 additions)
  if (contentContext?.business?.name) {
    data.nickname = contentContext.business.name;
  } else if (username) {
    data.nickname = username;
  }
  if (contentContext?.business?.tagline) {
    data.bio = contentContext.business.tagline;
  }

  // Step 3 — Company Info
  if (contentContext?.business?.name) data.name = contentContext.business.name;
  if (contentContext?.business?.industry) data.industry = contentContext.business.industry;
  if (contentContext?.business?.contactInfo?.address) data.address = contentContext.business.contactInfo.address;
  if (contentContext?.business?.contactInfo?.phone) data.phone = contentContext.business.contactInfo.phone;
  if (contentContext?.business?.contactInfo?.email) data.email = contentContext.business.contactInfo.email;
  if (contentContext?.business?.tagline) data.description = contentContext.business.tagline;
  if (contentContext?.business?.uniqueSellingPoints?.length) {
    data.values = contentContext.business.uniqueSellingPoints.join(', ');
  }

  // Mission & history
  if (contentContext?.business?.mission) data.mission = contentContext.business.mission;
  if (contentContext?.business?.history) data.history = contentContext.business.history;

  // Team — parse free-text into structured array [{name, position, bio}]
  const teamRaw = contentContext?.business?.team;
  if (teamRaw) {
    data.team = parseTeamText(teamRaw);
  }

  // Services array
  if (contentContext?.business?.services?.length) {
    data.services = contentContext.business.services.map(s =>
      typeof s === 'string' ? { name: s, description: '', features: '' } : s
    );
  }

  return data;
}

/**
 * Parse a free-text team description into a structured array.
 * Handles comma/semicolon/newline separated entries like:
 *   "John Doe - CEO, Jane Smith - CTO"
 *   "John Doe (CEO): runs the company; Jane Smith (CTO): builds the product"
 *
 * @param {string|Array} teamText
 * @returns {Array<{name: string, position: string, bio: string}>}
 */
function parseTeamText(teamText) {
  if (Array.isArray(teamText)) return teamText;
  if (typeof teamText !== 'string' || !teamText.trim()) return [];

  const entries = teamText.split(/[;\n]+/).map(e => e.trim()).filter(Boolean);
  return entries.map(entry => {
    // Try "Name - Position: Bio" or "Name (Position): Bio" patterns
    const dashMatch = entry.match(/^([^-–(]+)\s*[-–]\s*([^:,]+)(?:[,:]\s*(.*))?$/);
    if (dashMatch) {
      return { name: dashMatch[1].trim(), position: dashMatch[2].trim(), bio: (dashMatch[3] || '').trim() };
    }

    const parenMatch = entry.match(/^([^(]+)\(([^)]+)\)(?:[,:]\s*(.*))?$/);
    if (parenMatch) {
      return { name: parenMatch[1].trim(), position: parenMatch[2].trim(), bio: (parenMatch[3] || '').trim() };
    }

    // Fallback: treat the whole entry as a name
    return { name: entry, position: '', bio: '' };
  });
}
