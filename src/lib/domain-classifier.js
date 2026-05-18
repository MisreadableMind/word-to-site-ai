import { parse, getDomain } from 'tldts';

export const PLATFORM_HOSTS = [
  'at.wordtosite.ai',
  'wordtosite.ai',
  'instawp.xyz',
  'instawp.com',
];

export const PRIMARY_PLATFORM_HOST = PLATFORM_HOSTS[0];

const RESERVED_TLDS = new Set([
  'local',
  'localhost',
  'test',
  'internal',
  'example',
  'invalid',
  'onion',
]);

const platformMatcher = new RegExp(
  `(?:^|\\.)(?:${PLATFORM_HOSTS.map((h) => h.replace(/\./g, '\\.')).join('|')})$`,
  'i',
);

export function isPlatformHost(input) {
  if (!input || typeof input !== 'string') return false;
  return platformMatcher.test(input.trim().toLowerCase().replace(/\.$/, ''));
}

export function classify(rawInput) {
  if (rawInput == null || typeof rawInput !== 'string') {
    return { kind: 'invalid', input: String(rawInput ?? ''), reason: 'empty' };
  }

  const input = rawInput.trim().toLowerCase().replace(/\.$/, '');
  if (!input) return { kind: 'invalid', input: rawInput, reason: 'empty' };
  if (input.length > 253) return { kind: 'invalid', input, reason: 'too_long' };
  if (input.startsWith('xn--') || input.includes('.xn--')) {
    return { kind: 'invalid', input, reason: 'punycode' };
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(input)) {
    return { kind: 'invalid', input, reason: 'malformed' };
  }
  if (/^\d+\.\d+\.\d+\.\d+$/.test(input)) {
    return { kind: 'invalid', input, reason: 'ip_literal' };
  }

  if (platformMatcher.test(input)) {
    const baseHost = PLATFORM_HOSTS.find((h) => input === h || input.endsWith(`.${h}`));
    return { kind: 'platform_subdomain', input, baseHost };
  }

  const parsed = parse(input);
  const apex = getDomain(input);

  if (!parsed.publicSuffix || !apex) {
    return { kind: 'reserved', input, reason: 'unsupported_tld' };
  }

  const lastLabel = input.split('.').pop();
  if (RESERVED_TLDS.has(lastLabel)) {
    return { kind: 'reserved', input, reason: 'special_use' };
  }

  const tld = parsed.publicSuffix;
  const sld = parsed.domainWithoutSuffix;

  if (!sld) {
    return { kind: 'reserved', input, reason: 'unsupported_tld' };
  }

  if (input === apex) {
    return { kind: 'registerable', input, apex, sld, tld };
  }

  return { kind: 'subdomain', input, apex, sld, tld };
}

export function assertRegisterable(input) {
  const c = classify(input);
  if (c.kind !== 'registerable') {
    const err = new Error(`Domain ${input} is not registerable (${c.kind}${c.reason ? `:${c.reason}` : ''})`);
    err.classification = c;
    throw err;
  }
  return c;
}
