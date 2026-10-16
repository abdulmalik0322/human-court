// Cookie-based JWT auth. The token lives in an httpOnly `hc_token`
// cookie (SameSite=Lax, Secure in production, 7-day expiry).
import jwt from 'jsonwebtoken';
import { HttpError } from './errorHandler.js';

const COOKIE_NAME = 'hc_token';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export function createAuth({ repo, jwtSecret, isProd, cookieSameSite = 'lax' }) {
  function signToken(userId) {
    return jwt.sign({ sub: userId }, jwtSecret, { expiresIn: '7d' });
  }

  function setAuthCookie(res, token) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: cookieSameSite,
      secure: cookieSameSite === 'none' ? true : Boolean(isProd),
      maxAge: SEVEN_DAYS_MS,
      path: '/',
    });
  }

  function clearAuthCookie(res) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      sameSite: cookieSameSite,
      secure: cookieSameSite === 'none' ? true : Boolean(isProd),
      path: '/',
    });
  }

  // Attaches req.user or throws 401. Never reveals whether the user
  // record still exists vs. the token being invalid.
  async function requireAuth(req, _res, next) {
    try {
      const token = req.cookies && req.cookies[COOKIE_NAME];
      if (!token) throw new HttpError(401, 'unauthorized', 'Please log in.');
      let payload;
      try {
        payload = jwt.verify(token, jwtSecret);
      } catch {
        throw new HttpError(401, 'unauthorized', 'Your session has expired. Please log in again.');
      }
      const user = await repo.getUserById(payload.sub);
      if (!user) throw new HttpError(401, 'unauthorized', 'Please log in.');
      req.user = user;
      next();
    } catch (err) {
      next(err);
    }
  }

  return { requireAuth, signToken, setAuthCookie, clearAuthCookie, COOKIE_NAME };
}
