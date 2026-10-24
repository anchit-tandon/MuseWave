// 4-digit PIN sign-in for the single owner of MuseWave. Server only.
//
// Files in api/ that start with "_" are not Vercel functions, so this module
// is only reachable through api/auth.mjs.
//
// - The PIN lives nowhere. The server env var APP_PIN_HASH holds its scrypt
//   hash as "salt:hash" (hex), made with `node scripts/pin-hash.mjs`. If the
//   env var is missing or malformed, sign-in stays closed. There is no
//   fallback of any kind.
// - Five wrong tries, then a 15-minute lock. Each try is CLAIMED before the
//   PIN is checked, so a burst of parallel guesses cannot get past the limit.
// - The session is an httpOnly, Secure, SameSite=Lax cookie holding a random
//   token, a fixed expiry and an HMAC over both. The HMAC key is derived from
//   APP_PIN_HASH, so nobody without the server env var can mint a session and
//   changing the PIN signs out every device.
import { scrypt, randomBytes, timingSafeEqual, createHmac, createHash } from 'node:crypto';

export const PIN_RE = /^\d{4}$/;
export const MAX_TRIES = 5;
export const LOCK_MINUTES = 15;
export const LOCK_MS = LOCK_MINUTES * 60_000;
export const SESSION_COOKIE = 'mw_session';
export const SESSION_DAYS = 30;
export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60; // seconds

// One owner, so one identifier to count tries against.
const OWNER = 'owner';

// Must match scripts/pin-hash.mjs.
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };

// ---- PIN hash ---------------------------------------------------------------
export function isPinShape(pin) {
  return typeof pin === 'string' && PIN_RE.test(pin);
}

export function parsePinHash(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = /^([0-9a-f]{32}):([0-9a-f]{64})$/.exec(raw.trim());
  return m ? { salt: m[1], hash: m[2] } : null;
}

function derive(pin, salt) {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => {
      if (err) reject(err);
      else resolve(key);
    });
  });
}

export async function hashPin(pin, salt = randomBytes(16).toString('hex')) {
  const key = await derive(pin, salt);
  return `${salt}:${key.toString('hex')}`;
}

// Constant-time compare.
export async function verifyPin(pin, stored) {
  const a = await derive(pin, stored.salt);
  const b = Buffer.from(stored.hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

// ---- lockout ----------------------------------------------------------------
// Where the count lives:
// - If an Upstash Redis REST endpoint is configured (UPSTASH_REDIS_REST_URL +
//   UPSTASH_REDIS_REST_TOKEN, or the Vercel KV names KV_REST_API_URL +
//   KV_REST_API_TOKEN), the claim is one Lua script there, atomic across every
//   server instance.
// - Otherwise it lives in this server process. The claim is synchronous, so it
//   is atomic within the process, but Vercel may run several processes, each
//   with its own count.
export function memoryStore(now = Date.now) {
  const map = new Map();
  const get = (id) => {
    let e = map.get(id);
    if (!e) { e = { tries: 0, lockedUntil: 0 }; map.set(id, e); }
    return e;
  };
  return {
    async claim(id) {
      const e = get(id);
      if (e.lockedUntil > now()) return { ok: false, lockedUntil: e.lockedUntil };
      e.tries += 1;
      return { ok: true, tries: e.tries };
    },
    async lock(id) {
      const e = get(id);
      if (!(e.lockedUntil > now())) e.lockedUntil = now() + LOCK_MS;
      e.tries = 0;
      return e.lockedUntil;
    },
    async reset(id) {
      get(id).tries = 0;
    },
  };
}

const CLAIM_LUA = `
local ttl = redis.call('PTTL', KEYS[2])
if ttl > 0 then return {0, ttl} end
return {redis.call('INCR', KEYS[1]), 0}`;
const LOCK_LUA = `
redis.call('SET', KEYS[2], '1', 'PX', ARGV[1], 'NX')
redis.call('DEL', KEYS[1])
return redis.call('PTTL', KEYS[2])`;

export function upstashStore(url, token, fetchImpl = fetch, now = Date.now) {
  const keys = (id) => [`musewave:pin:tries:${id}`, `musewave:pin:lock:${id}`];
  async function cmd(args) {
    const res = await fetchImpl(url.replace(/\/+$/, ''), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args.map(String)),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !body || body.error) throw new Error(`lockout store error (${res.status})`);
    return body.result;
  }
  return {
    async claim(id) {
      const [tries, lock] = keys(id);
      const r = await cmd(['EVAL', CLAIM_LUA, 2, tries, lock]);
      if (!Array.isArray(r) || r.length !== 2) throw new Error('lockout store: bad reply');
      const n = Number(r[0]);
      if (n === 0) return { ok: false, lockedUntil: now() + Number(r[1]) };
      return { ok: true, tries: n };
    },
    async lock(id) {
      const [tries, lock] = keys(id);
      const ttl = Number(await cmd(['EVAL', LOCK_LUA, 2, tries, lock, LOCK_MS]));
      return now() + (ttl > 0 ? ttl : LOCK_MS);
    },
    async reset(id) {
      await cmd(['DEL', keys(id)[0]]);
    },
  };
}

let chosen = null;
export function lockoutStore(env = process.env) {
  if (chosen) return chosen;
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  chosen = url && token ? upstashStore(url, token) : memoryStore();
  return chosen;
}

// ---- session ----------------------------------------------------------------
const VERSION = 'v1';

function sessionKey(secret) {
  return createHash('sha256').update(`musewave-session-${VERSION}\n${secret}`).digest();
}
function sign(body, secret) {
  return createHmac('sha256', sessionKey(secret)).update(body).digest('base64url');
}

export function createSessionToken(secret, nowMs = Date.now()) {
  const exp = Math.floor(nowMs / 1000) + SESSION_MAX_AGE;
  const body = `${VERSION}.${exp}.${randomBytes(32).toString('base64url')}`;
  return `${body}.${sign(body, secret)}`;
}

export function verifySessionToken(token, secret, nowMs = Date.now()) {
  if (!token || !secret || typeof token !== 'string' || token.length > 200) return false;
  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== VERSION || !/^\d{1,12}$/.test(parts[1])) return false;
  if (Number(parts[1]) * 1000 <= nowMs) return false;
  const want = Buffer.from(sign(parts.slice(0, 3).join('.'), secret));
  const got = Buffer.from(parts[3]);
  return want.length === got.length && timingSafeEqual(want, got);
}

export function readCookie(header, name) {
  if (!header) return null;
  for (const part of String(header).split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function sessionCookie(value, maxAge = SESSION_MAX_AGE) {
  return `${SESSION_COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Lax`;
}

// ---- words (no em or en dashes) ---------------------------------------------
export function lockMessage(lockedUntil, now = Date.now()) {
  const mins = Math.max(1, Math.ceil((lockedUntil - now) / 60_000));
  return `Too many wrong tries. Try again in ${mins} ${mins === 1 ? 'minute' : 'minutes'}.`;
}

export function wrongPinMessage(left) {
  return `That PIN is not right. ${left} ${left === 1 ? 'try' : 'tries'} left.`;
}

// ---- the request handler, kept free of Vercel types so it can be tested -----
//   GET    -> { signedIn }
//   POST   { pin: "1234" } -> sets the session cookie
//   DELETE -> clears it (sign out)
export async function handleAuth({ method, body, cookie }, { env = process.env, store = lockoutStore(env), now = Date.now } = {}) {
  const rawHash = typeof env.APP_PIN_HASH === 'string' ? env.APP_PIN_HASH.trim() : '';
  const stored = parsePinHash(rawHash);

  if (method === 'GET') {
    const signedIn = !!stored && verifySessionToken(readCookie(cookie, SESSION_COOKIE), rawHash, now());
    return { status: 200, body: { signedIn, configured: !!stored } };
  }

  if (method === 'DELETE') {
    return { status: 200, body: { ok: true }, setCookie: sessionCookie('', 0) };
  }

  if (method !== 'POST') {
    return { status: 405, body: { ok: false, error: 'Method not allowed.' }, allow: 'GET, POST, DELETE' };
  }

  if (!stored) {
    return { status: 503, body: { ok: false, error: 'Sign-in is closed until the owner sets a PIN on the server.' } };
  }

  let data = body;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = null; }
  }
  const pin = data && typeof data === 'object' ? data.pin : undefined;
  if (!isPinShape(pin)) {
    return { status: 400, body: { ok: false, error: 'Type your 4-digit PIN, numbers only.' } };
  }

  try {
    const claim = await store.claim(OWNER);
    if (!claim.ok) {
      return { status: 429, body: { ok: false, locked: true, error: lockMessage(claim.lockedUntil, now()) } };
    }
    // Tries past the fifth were claimed by guesses already in flight.
    if (claim.tries > MAX_TRIES) {
      const until = await store.lock(OWNER);
      return { status: 429, body: { ok: false, locked: true, error: lockMessage(until, now()) } };
    }
    if (!(await verifyPin(pin, stored))) {
      if (claim.tries >= MAX_TRIES) {
        const until = await store.lock(OWNER);
        return { status: 429, body: { ok: false, locked: true, error: lockMessage(until, now()) } };
      }
      const left = MAX_TRIES - claim.tries;
      return { status: 401, body: { ok: false, left, error: wrongPinMessage(left) } };
    }
    await store.reset(OWNER);
  } catch (e) {
    console.error('PIN sign-in: lockout store unavailable', e instanceof Error ? e.message : e);
    return { status: 503, body: { ok: false, error: 'Sign-in is unavailable right now. Please try again in a minute.' } };
  }

  return { status: 200, body: { ok: true }, setCookie: sessionCookie(createSessionToken(rawHash, now())) };
}
