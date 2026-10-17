// PIN sign-in rules. Run with `npm test` (node:test, no extra dependencies).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  handleAuth, memoryStore, hashPin, parsePinHash, verifySessionToken,
  createSessionToken, readCookie, SESSION_COOKIE, LOCK_MS,
} from '../api/_pinauth.mjs';
import { pinHash as scriptHash, pinError } from '../scripts/pin-hash.mjs';
import authFn from '../api/auth.mjs';

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const PIN = '4827';
const HASH = await hashPin(PIN);
const env = { APP_PIN_HASH: HASH };

function fresh(now = () => Date.now()) {
  return { env, store: memoryStore(now), now };
}
const post = (pin, deps) => handleAuth({ method: 'POST', body: { pin } }, deps);

test('right PIN signs in and sets a secure httpOnly cookie', async () => {
  const r = await post(PIN, fresh());
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { ok: true });
  assert.match(r.setCookie, /^mw_session=v1\./);
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/', 'Max-Age=2592000']) {
    assert.ok(r.setCookie.includes(flag), flag);
  }
  const token = readCookie(r.setCookie.split(';')[0], SESSION_COOKIE);
  const me = await handleAuth({ method: 'GET', cookie: `${SESSION_COOKIE}=${token}` }, fresh());
  assert.equal(me.body.signedIn, true);
});

test('wrong PIN counts down, then locks at 5 for 15 minutes', async () => {
  let t = 1_000_000;
  const deps = fresh(() => t);
  for (const left of [4, 3, 2, 1]) {
    const r = await post('0000', deps);
    assert.equal(r.status, 401);
    assert.equal(r.body.error, `That PIN is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`);
  }
  const fifth = await post('0000', deps);
  assert.equal(fifth.status, 429);
  assert.equal(fifth.body.error, 'Too many wrong tries. Try again in 15 minutes.');
  // Locked: even the right PIN is refused.
  const right = await post(PIN, deps);
  assert.equal(right.status, 429);
  assert.equal(right.setCookie, undefined);
  t += LOCK_MS + 1;
  assert.equal((await post(PIN, deps)).status, 200);
});

test('a burst of parallel guesses cannot get past 5', async () => {
  const deps = fresh();
  const results = await Promise.all(Array.from({ length: 20 }, () => post('1111', deps)));
  assert.equal(results.filter((r) => r.status === 401).length, 4);
  assert.equal((await post(PIN, deps)).status, 429);
});

test('a right PIN resets the count', async () => {
  const deps = fresh();
  await post('0000', deps);
  await post('0000', deps);
  assert.equal((await post(PIN, deps)).status, 200);
  assert.equal((await post('0000', deps)).body.left, 4);
});

test('3-digit, 5-digit and non-digit PINs are refused without using a try', async () => {
  const deps = fresh();
  for (const bad of ['482', '48270', '48a7', ' 4827', 4827, '', null, undefined]) {
    const r = await post(bad, deps);
    assert.equal(r.status, 400, String(bad));
    assert.equal(r.body.error, 'Type your 4-digit PIN, numbers only.');
  }
  assert.equal((await post('0000', deps)).body.left, 4);
});

test('no APP_PIN_HASH means sign-in stays closed', async () => {
  for (const e of [{}, { APP_PIN_HASH: '' }, { APP_PIN_HASH: 'not-a-hash' }]) {
    const r = await handleAuth({ method: 'POST', body: { pin: PIN } }, { env: e, store: memoryStore() });
    assert.equal(r.status, 503);
    assert.equal(r.setCookie, undefined);
    const me = await handleAuth({ method: 'GET', cookie: '' }, { env: e, store: memoryStore() });
    assert.equal(me.body.signedIn, false);
  }
});

test('session tokens: forged, expired or from another PIN are rejected', async () => {
  const tok = createSessionToken(HASH, 0);
  assert.equal(verifySessionToken(tok, HASH, 1000), true);
  assert.equal(verifySessionToken(tok, HASH, 31 * 24 * 3600 * 1000), false);
  assert.equal(verifySessionToken(tok, await hashPin('5938'), 1000), false);
  assert.equal(verifySessionToken(tok.slice(0, -2) + 'AA', HASH, 1000), false);
  assert.equal(verifySessionToken('true', HASH, 1000), false);
});

test('sign out clears the cookie; other methods are refused', async () => {
  const out = await handleAuth({ method: 'DELETE' }, fresh());
  assert.match(out.setCookie, /^mw_session=; .*Max-Age=0/);
  assert.equal((await handleAuth({ method: 'PUT' }, fresh())).status, 405);
});

test('scripts/pin-hash.mjs output verifies on the server and weak PINs are refused', async () => {
  const value = scriptHash(PIN);
  assert.ok(parsePinHash(value));
  const r = await handleAuth({ method: 'POST', body: JSON.stringify({ pin: PIN }) }, { env: { APP_PIN_HASH: value }, store: memoryStore() });
  assert.equal(r.status, 200);
  assert.equal(pinError('482'), 'A PIN is exactly 4 numbers, for example 4827.');
  assert.match(pinError('1234'), /first anyone would try/);
  assert.match(pinError('5555'), /first anyone would try/);
  assert.equal(pinError(PIN), null);
});

test('the Vercel function wires status, cookie and no-store', async () => {
  const prev = process.env.APP_PIN_HASH;
  delete process.env.APP_PIN_HASH;
  const headers = {};
  let status = 0, json;
  const res = {
    setHeader: (k, v) => { headers[k] = v; },
    status(s) { status = s; return this; },
    json(b) { json = b; },
  };
  await authFn({ method: 'POST', body: { pin: PIN }, headers: {} }, res);
  if (prev !== undefined) process.env.APP_PIN_HASH = prev;
  assert.equal(status, 503);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(json.ok, false);
});

test('old sign-in is gone: no hard-coded credentials, no username or password, no local session', () => {
  const ctx = readFileSync(root('src/contexts/AuthContext.tsx'), 'utf8');
  const page = readFileSync(root('src/pages/LoginPage.tsx'), 'utf8');
  for (const src of [ctx, page]) {
    assert.doesNotMatch(src, /CREDENTIALS|AnchitAnya/);
    assert.doesNotMatch(src, /username/i);
    assert.doesNotMatch(src, /localStorage\.setItem/);
  }
  assert.doesNotMatch(page, /type="text"|Password/);
  assert.match(page, /inputMode="numeric"/);
  assert.match(page, /maxLength=\{4\}/);
  assert.match(page, /autoComplete="current-password"/);
  // The PIN check runs on the server only.
  assert.match(ctx, /fetch\(AUTH_URL/);
  // No dashes that read as em or en dashes in user copy.
  for (const f of ['src/pages/LoginPage.tsx', 'src/contexts/AuthContext.tsx', 'src/components/ProtectedRoute.tsx', 'api/_pinauth.mjs']) {
    assert.doesNotMatch(readFileSync(root(f), 'utf8'), /[–—]/, f);
  }
});

test('the PIN function is deployed; other api functions stay ignored', () => {
  const ignore = readFileSync(root('.vercelignore'), 'utf8').split('\n').map((l) => l.trim());
  assert.ok(ignore.includes('api/*'));
  assert.ok(ignore.includes('!api/auth.mjs'));
  assert.ok(ignore.includes('!api/_pinauth.mjs'));
  assert.ok(!ignore.includes('api/'));
  assert.ok(existsSync(root('api/auth.mjs')));
});
