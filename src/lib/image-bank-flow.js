import { config } from '../config.js';
import ContentBankService from '../services/content-bank-service.js';

let _client = null;
function client() {
  if (!_client) _client = new ContentBankService();
  return _client;
}

export function isContentBankEnabled() {
  return client().enabled;
}

export function buildCallbackUrl(baseUrl, login) {
  if (!baseUrl || !login) return null;
  return `${baseUrl.replace(/\/+$/, '')}/api/content-bank/callback?login=${encodeURIComponent(login)}`;
}

export async function provisionContentBankUser({
  site,
  deploymentContext,
  contentContext,
  email,
  existingCreds,
}) {
  const bank = client();
  if (!bank.enabled) return null;
  const domain = site?.domain || (site?.wp_url ? new URL(site.wp_url).hostname : null);
  if (!domain) return null;
  if (existingCreds?.login && existingCreds?.password) {
    return { login: existingCreds.login, password: existingCreds.password };
  }
  return bank.createUser({
    domain,
    name: deploymentContext?.branding?.siteTitle || contentContext?.business?.name,
    email,
  });
}

export async function startSiteImageGeneration({
  wp,
  site,
  deploymentContext,
  contentContext,
  email,
  callbackBaseUrl,
  onProgress,
  existingCreds,
}) {
  const creds = await provisionContentBankUser({
    site,
    deploymentContext,
    contentContext,
    email,
    existingCreds,
  });
  if (!creds) return null;

  const callbackUrl = buildCallbackUrl(callbackBaseUrl, creds.login);

  const wpResult = await wp.generateImages(
    { ...creds, scoreThreshold: config.imageBank.scoreThreshold },
    {
      callbackUrl,
      awaitCompletion: true,
      onProgress,
    },
  );

  const terminalStatus = wpResult?.pollResult?.status;
  const status = terminalStatus === 'generate_images_end' ? 'ready' : 'failed';

  return { ...creds, status, callbackUrl, pollResult: wpResult?.pollResult ?? null };
}
