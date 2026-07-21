'use strict';

const PROVIDERS = Object.freeze(['COMMERCE', 'POS', 'ERP', 'INVENTORY', 'CRM', 'MARKET_DATA']);

function providerReadiness(env = process.env) {
  const providers = PROVIDERS.map((name) => {
    const enabled = env[`${name}_PROVIDER_ENABLED`] === 'true';
    const endpoint = String(env[`${name}_PROVIDER_URL`] || '');
    const credential = String(env[`${name}_PROVIDER_TOKEN`] || '');
    return { name: name.toLowerCase(), enabled, ready: enabled && /^https:\/\//.test(endpoint) && Boolean(credential) };
  });
  return { ready: providers.every((item) => item.ready), providers };
}

function requireProviders(names, env = process.env) {
  const readiness = providerReadiness(env);
  const requested = names.map((name) => String(name).toLowerCase());
  const known = new Set(readiness.providers.map((item) => item.name));
  const unknown = requested.filter((name) => !known.has(name));
  const unavailable = readiness.providers.filter((item) => requested.includes(item.name) && !item.ready);
  if (unknown.length || unavailable.length) throw Object.assign(new Error(`providers not ready: ${[...unknown, ...unavailable.map((item) => item.name)].join(', ')}`), { code: 'PROVIDER_NOT_READY' });
  return readiness.providers.filter((item) => requested.includes(item.name));
}

module.exports = { PROVIDERS, providerReadiness, requireProviders };
