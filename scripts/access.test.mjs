import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

function harness(fetchImpl, allowedUsers = ['shalom-lab']) {
  const source = fs.readFileSync(new URL('../apps/console/src/lib/github.ts', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const storage = new Map();
  const context = { exports: {}, require: () => ({ allowedGitHubUsers: allowedUsers }), fetch: fetchImpl,
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) },
    window: { dispatchEvent() {} }, Event,
  };
  vm.runInNewContext(compiled, context);
  return context.exports;
}
const settings = { pat: 'test-only-token', repoFull: 'visitor/anything' };

test('missing token blocks without a network request', async () => {
  const api = harness(() => { throw new Error('Unexpected request'); });
  const result = await api.probeGitHubAccess({ ...settings, pat: '  ' });
  assert.equal(result.ok, false);
  assert.match(result.message, /请先填写/);
});
test('invalid, rate-limited, and unavailable authentication all block reading', async () => {
  for (const status of [401, 403, 429, 500]) {
    const api = harness(async () => ({ ok: false, status }));
    assert.equal((await api.probeGitHubAccess(settings)).ok, false);
  }
  const offline = harness(async () => { throw new Error('offline'); });
  assert.equal((await offline.probeGitHubAccess(settings)).ok, false);
});
test('valid token for a different account cannot unlock static content', async () => {
  const api = harness(async () => ({ ok: true, json: async () => ({ login: 'someone-else' }) }));
  assert.equal((await api.probeGitHubAccess(settings)).ok, false);
});
test('allowlisted identity is case-insensitive and only uses GitHub user endpoint', async () => {
  let requests = 0;
  const api = harness(async (url, options) => {
    requests++;
    assert.equal(url, 'https://api.github.com/user');
    assert.equal(options.headers.Authorization, 'Bearer test-only-token');
    assert.equal(options.cache, 'no-store');
    return { ok: true, json: async () => ({ login: 'Shalom-Lab' }) };
  });
  assert.equal((await api.probeGitHubAccess(settings)).ok, true);
  assert.equal(requests, 1);
});
test('empty policy and malformed user responses deny access', async () => {
  const api = harness(() => { throw new Error('Unexpected request'); }, []);
  assert.equal((await api.probeGitHubAccess(settings)).ok, false);
  const malformed = harness(async () => ({ ok: true, json: async () => ({}) }));
  assert.equal((await malformed.probeGitHubAccess(settings)).ok, false);
});
test('changing or removing a saved token cannot reuse a previous validation', async () => {
  const api = harness(async (url, options) => options.headers.Authorization === 'Bearer test-only-token'
    ? { ok: true, json: async () => ({ login: 'shalom-lab' }) }
    : { ok: false, status: 401 });
  api.saveSettings(settings);
  assert.equal((await api.probeGitHubAccess()).ok, true);
  api.saveSettings({ ...settings, pat: 'invalid-test-token' });
  assert.equal((await api.probeGitHubAccess()).ok, false);
  api.saveSettings({ ...settings, pat: '' });
  assert.equal((await api.probeGitHubAccess()).ok, false);
});
