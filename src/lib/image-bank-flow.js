import { config } from '../config';
import ContentBankService from '../services/content-bank-service';

export async function provisionImageBank({ wp, domain, name, email }) {
  const bank = new ContentBankService();
  if (!bank.enabled) {
    console.warn('  Image bank skipped: IMAGE_BANK_LOGIN / IMAGE_BANK_PASSWORD not configured');
    return null;
  }
  if (!domain) {
    console.warn('  Image bank skipped: no domain available for content bank user');
    return null;
  }

  let creds;
  try {
    creds = await bank.createUser({ domain, name, email });
  } catch (error) {
    const detail = `${error.message}${error.status ? ` (status ${error.status})` : ''}`;
    console.error(`  Image bank createUser failed: ${detail}`);
    throw new Error(`createUser: ${detail}`);
  }

  try {
    await wp.registerImageBankCredentials({
      login: creds.login,
      password: creds.password,
      threshold: config.imageBank.threshold,
    });
  } catch (error) {
    console.error(`  Image bank credential registration failed: ${error.message}`);
    throw new Error(`registerImageBankCredentials: ${error.message}`);
  }

  console.log('  Image bank credentials registered');
  return { login: creds.login, password: creds.password, status: 'pending' };
}
