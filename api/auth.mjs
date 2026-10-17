// The only way into MuseWave: a 4-digit PIN checked here, on the server.
//
//   GET    /api/auth               -> { signedIn }
//   POST   /api/auth { pin: "1234" } -> sets the httpOnly session cookie
//   DELETE /api/auth               -> clears it (sign out)
//
// There is no username, password, OAuth or OTP. See api/_pinauth.mjs.
import { handleAuth } from './_pinauth.mjs';

export default async function handler(req, res) {
  const out = await handleAuth({
    method: req.method,
    body: req.body,
    cookie: req.headers?.cookie,
  });
  res.setHeader('Cache-Control', 'no-store');
  if (out.setCookie) res.setHeader('Set-Cookie', out.setCookie);
  if (out.allow) res.setHeader('Allow', out.allow);
  res.status(out.status).json(out.body);
}
