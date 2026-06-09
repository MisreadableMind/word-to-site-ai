import { Resolver } from 'node:dns/promises';
import pWaitFor, { TimeoutError } from 'p-wait-for';

const PUBLIC_RESOLVERS = ['1.1.1.1', '8.8.8.8'];

function makeResolver() {
  const resolver = new Resolver();
  resolver.setServers(PUBLIC_RESOLVERS);
  return resolver;
}

export async function resolveExpectedIps(host) {
  const ips = await makeResolver().resolve4(host);
  if (!ips.length) {
    throw new Error(`Could not resolve any A record for host ${host}`);
  }
  return ips;
}

async function resolveAddresses(resolver, name) {
  try {
    return await resolver.resolve4(name);
  } catch {
    return [];
  }
}

export async function checkDnsMatches(domain, host, { includeWww = true } = {}) {
  const resolver = makeResolver();
  const expected = new Set(await resolveExpectedIps(host));
  const apex = await resolveAddresses(resolver, domain);
  const www = includeWww ? await resolveAddresses(resolver, `www.${domain}`) : [];
  const apexOk = apex.some((ip) => expected.has(ip));
  const wwwOk = !includeWww || www.some((ip) => expected.has(ip));
  return { ok: apexOk && wwwOk, apex, www, expected: [...expected] };
}

export async function waitForDnsResolves(domain, host, { includeWww = true, timeout = 20 * 60_000, interval = 30_000, onProgress } = {}) {
  let last = { apex: [], www: [], expected: [] };
  try {
    await pWaitFor(async () => {
      const result = await checkDnsMatches(domain, host, { includeWww });
      last = result;
      if (onProgress) onProgress(result);
      return result.ok;
    }, { interval, timeout });
  } catch (error) {
    if (error instanceof TimeoutError) {
      const wwwPart = includeWww ? ` www=${last.www.join(',') || 'none'}` : '';
      const wrapped = new Error(`DNS for ${domain} did not point at ${host} within ${Math.round(timeout / 1000)}s (apex=${last.apex.join(',') || 'none'}${wwwPart}; expected one of ${last.expected.join(',')}).`);
      wrapped.code = 'DNS_TIMEOUT';
      throw wrapped;
    }
    throw error;
  }
}
