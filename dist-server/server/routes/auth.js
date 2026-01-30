import { Router } from 'express';
import crypto from 'crypto';
import { eq, and, isNull, or } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users, subscriptions } from '../../db/schema.js';
import { getTokenFromCookie, setAuthCookies, clearAuthCookies, clearOAuthCookies, setOAuthStateCookie, setPKCECookie, getStateCookie, getPKCECookie, ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE, } from '../middleware/cookies.js';
import { verifyAccessToken, verifyRefreshToken, createAccessToken, createRefreshToken, revokeRefreshToken, decodeRefreshToken, } from '../../api/_lib/auth/tokens.js';
import { generateState, generatePKCE, buildYandexAuthUrl, exchangeYandexCode, validateState, } from '../../api/_lib/auth/oauth.js';
import { checkAuthRateLimit, checkMeRateLimit, checkRefreshRateLimit, checkOAuthRedirectRateLimit, } from '../middleware/rate-limit.js';
import { logOAuthCallbackSuccess, logOAuthCallbackFailed, logRateLimitExceeded, logCsrfDetected, logInvalidSignature, logExpiredAuth, } from '../middleware/audit-log.js';
const router = Router();
// ==================== GET /api/auth/me ====================
router.get('/me', async (req, res) => {
    const rateLimitResult = await checkMeRateLimit(req);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    try {
        const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE);
        if (!token) {
            return res.status(401).json({ error: 'Not authenticated' });
        }
        const payload = verifyAccessToken(token);
        if (!payload) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const [user] = await db
            .select({
            id: users.id,
            email: users.email,
            name: users.name,
            role: users.role,
            generationsLeft: users.generationsLeft,
            createdAt: users.createdAt,
        })
            .from(users)
            .where(eq(users.id, payload.sub))
            .limit(1);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        const [subscription] = await db
            .select({
            plan: subscriptions.plan,
            status: subscriptions.status,
            expiresAt: subscriptions.expiresAt,
        })
            .from(subscriptions)
            .where(eq(subscriptions.userId, payload.sub))
            .limit(1);
        return res.status(200).json({
            user: {
                ...user,
                subscription: subscription || { plan: 'free', status: 'active', expiresAt: null }
            }
        });
    }
    catch (error) {
        console.error('[Auth Me] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
// ==================== POST /api/auth/logout ====================
router.post('/logout', async (req, res) => {
    try {
        const refreshToken = getTokenFromCookie(req, REFRESH_TOKEN_COOKIE);
        if (refreshToken) {
            const payload = decodeRefreshToken(refreshToken);
            if (payload?.jti) {
                await revokeRefreshToken(payload.jti);
            }
        }
        clearAuthCookies(res);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[Logout] Error:', error);
        clearAuthCookies(res);
        return res.status(200).json({ success: true });
    }
});
// ==================== POST /api/auth/refresh ====================
router.post('/refresh', async (req, res) => {
    const rateLimitResult = await checkRefreshRateLimit(req);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many refresh attempts' });
    }
    try {
        const refreshToken = getTokenFromCookie(req, REFRESH_TOKEN_COOKIE);
        if (!refreshToken) {
            return res.status(401).json({ error: 'No refresh token' });
        }
        const payload = await verifyRefreshToken(refreshToken);
        if (!payload) {
            clearAuthCookies(res);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        const [user] = await db
            .select({
            id: users.id,
            email: users.email,
            role: users.role,
        })
            .from(users)
            .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
            .limit(1);
        if (!user) {
            clearAuthCookies(res);
            return res.status(401).json({ error: 'User not found' });
        }
        await revokeRefreshToken(payload.jti);
        const newAccessToken = createAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const newRefreshToken = await createRefreshToken(user.id);
        setAuthCookies(res, {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        });
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[Refresh] Error:', error);
        clearAuthCookies(res);
        return res.status(401).json({ error: 'Token refresh failed' });
    }
});
// ==================== GET /api/auth/yandex/redirect ====================
router.get('/yandex/redirect', async (req, res) => {
    const rateLimitResult = await checkOAuthRedirectRateLimit(req);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        console.warn('[Yandex OAuth] Rate limit exceeded on redirect');
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests. Please try again later.' });
    }
    try {
        const clientId = process.env.YANDEX_CLIENT_ID;
        const appUrl = process.env.APP_URL;
        if (!clientId) {
            console.error('[Yandex OAuth] YANDEX_CLIENT_ID not configured');
            return res.status(500).json({ error: 'OAuth not configured' });
        }
        if (!appUrl) {
            console.error('[Yandex OAuth] APP_URL not configured');
            return res.status(500).json({ error: 'OAuth not configured' });
        }
        const state = generateState();
        const { codeVerifier, codeChallenge } = generatePKCE();
        setOAuthStateCookie(res, state);
        setPKCECookie(res, codeVerifier);
        const redirectUri = `${appUrl}/api/auth/yandex/callback`;
        const authUrl = buildYandexAuthUrl({
            clientId,
            redirectUri,
            state,
            codeChallenge,
        });
        return res.redirect(302, authUrl);
    }
    catch (error) {
        console.error('[Yandex OAuth] Redirect error:', error);
        return res.status(500).json({ error: 'Authentication failed' });
    }
});
// ==================== GET /api/auth/yandex/callback ====================
router.get('/yandex/callback', async (req, res) => {
    const appUrl = process.env.APP_URL || '';
    const rateLimitResult = await checkAuthRateLimit(req);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        logRateLimitExceeded(req, '/api/auth/yandex/callback');
        clearOAuthCookies(res);
        return res.redirect(302, `${appUrl}/login?error=rate_limit_exceeded`);
    }
    try {
        const { code, state, error: oauthError } = req.query;
        if (oauthError) {
            console.error('[Yandex OAuth] Provider error:', oauthError);
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=oauth_error`);
        }
        if (!code || typeof code !== 'string') {
            console.error('[Yandex OAuth] Missing authorization code');
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=invalid_request`);
        }
        if (!state || typeof state !== 'string') {
            console.error('[Yandex OAuth] Missing state parameter');
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=invalid_request`);
        }
        const storedState = getStateCookie(req);
        if (!storedState) {
            logCsrfDetected(req, 'yandex', { provided_state: state, expected_state: null });
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=invalid_state`);
        }
        const stateBuffer = Buffer.from(state, 'utf8');
        const storedBuffer = Buffer.from(storedState, 'utf8');
        const statesMatch = stateBuffer.length === storedBuffer.length &&
            crypto.timingSafeEqual(stateBuffer, storedBuffer);
        if (!statesMatch) {
            logCsrfDetected(req, 'yandex', { provided_state: state, expected_state: storedState });
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=invalid_state`);
        }
        if (!validateState(storedState)) {
            console.error('[Yandex OAuth] State expired or invalid format');
            logCsrfDetected(req, 'yandex', { state: storedState, reason: 'expired_or_invalid' });
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=invalid_state`);
        }
        const codeVerifier = getPKCECookie(req);
        if (!codeVerifier) {
            console.error('[Yandex OAuth] Missing PKCE code verifier');
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=invalid_request`);
        }
        const clientId = process.env.YANDEX_CLIENT_ID;
        const clientSecret = process.env.YANDEX_CLIENT_SECRET;
        if (!clientId || !clientSecret) {
            console.error('[Yandex OAuth] Missing OAuth credentials');
            clearOAuthCookies(res);
            return res.redirect(302, `${appUrl}/login?error=configuration_error`);
        }
        const oauthUser = await exchangeYandexCode({
            code,
            clientId,
            clientSecret,
            codeVerifier,
        });
        let [user] = await db
            .select()
            .from(users)
            .where(eq(users.email, oauthUser.email.toLowerCase()))
            .limit(1);
        if (!user) {
            const [newUser] = await db
                .insert(users)
                .values({
                email: oauthUser.email.toLowerCase(),
                name: oauthUser.name,
                image: oauthUser.image,
                provider: 'yandex',
                providerId: oauthUser.providerId,
                role: 'user',
                generationsLeft: 5,
            })
                .returning();
            user = newUser;
        }
        else if (!user.provider) {
            await db
                .update(users)
                .set({
                provider: 'yandex',
                providerId: oauthUser.providerId,
                image: user.image || oauthUser.image,
                updatedAt: new Date(),
            })
                .where(eq(users.id, user.id));
        }
        const accessToken = createAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = await createRefreshToken(user.id);
        setAuthCookies(res, { accessToken, refreshToken });
        clearOAuthCookies(res);
        logOAuthCallbackSuccess(req, user.id, user.email, 'yandex');
        return res.redirect(302, appUrl || '/');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logOAuthCallbackFailed(req, errorMessage, 'yandex');
        console.error('[Yandex OAuth] Callback error:', error);
        clearOAuthCookies(res);
        return res.redirect(302, `${appUrl}/login?error=authentication_failed`);
    }
});
// ==================== GET /api/auth/telegram/callback ====================
router.get('/telegram/callback', async (req, res) => {
    const appUrl = process.env.APP_URL || '';
    const rateLimitResult = await checkAuthRateLimit(req);
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        logRateLimitExceeded(req, '/api/auth/telegram/callback');
        return res.redirect(302, `${appUrl}/login?error=rate_limit_exceeded`);
    }
    try {
        const botToken = process.env.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            console.error('[Telegram Login] TELEGRAM_BOT_TOKEN not configured');
            return res.redirect(302, `${appUrl}/login?error=configuration_error`);
        }
        const { hash, auth_date, id, first_name, last_name, username, photo_url } = req.query;
        if (!hash || typeof hash !== 'string') {
            console.error('[Telegram Login] Missing hash parameter');
            return res.redirect(302, `${appUrl}/login?error=invalid_request`);
        }
        if (!auth_date || typeof auth_date !== 'string') {
            console.error('[Telegram Login] Missing auth_date parameter');
            return res.redirect(302, `${appUrl}/login?error=invalid_request`);
        }
        if (!id || typeof id !== 'string') {
            console.error('[Telegram Login] Missing id parameter');
            return res.redirect(302, `${appUrl}/login?error=invalid_request`);
        }
        const authTimestamp = parseInt(auth_date, 10);
        const currentTimestamp = Math.floor(Date.now() / 1000);
        const MAX_AGE_SECONDS = 5 * 60;
        if (currentTimestamp - authTimestamp > MAX_AGE_SECONDS) {
            logExpiredAuth(req, 'telegram', { auth_date: authTimestamp, current_time: currentTimestamp });
            return res.redirect(302, `${appUrl}/login?error=authentication_expired`);
        }
        const dataCheckParams = {};
        if (auth_date)
            dataCheckParams.auth_date = String(auth_date);
        if (first_name && typeof first_name === 'string')
            dataCheckParams.first_name = first_name;
        if (id)
            dataCheckParams.id = String(id);
        if (last_name && typeof last_name === 'string')
            dataCheckParams.last_name = last_name;
        if (photo_url && typeof photo_url === 'string')
            dataCheckParams.photo_url = photo_url;
        if (username && typeof username === 'string')
            dataCheckParams.username = username;
        const dataCheckString = Object.keys(dataCheckParams)
            .sort()
            .map(key => `${key}=${dataCheckParams[key]}`)
            .join('\n');
        const secretKey = crypto
            .createHash('sha256')
            .update(botToken)
            .digest();
        const calculatedHash = crypto
            .createHmac('sha256', secretKey)
            .update(dataCheckString)
            .digest('hex');
        const hashBuffer = Buffer.from(hash, 'hex');
        const calculatedBuffer = Buffer.from(calculatedHash, 'hex');
        if (hashBuffer.length !== calculatedBuffer.length ||
            !crypto.timingSafeEqual(hashBuffer, calculatedBuffer)) {
            logInvalidSignature(req, 'telegram', { telegram_id: String(id) });
            return res.redirect(302, `${appUrl}/login?error=invalid_signature`);
        }
        const telegramId = String(id);
        const name = [first_name || '', last_name || ''].filter(Boolean).join(' ') || null;
        const photoUrl = typeof photo_url === 'string' ? photo_url : null;
        const email = typeof username === 'string' && username
            ? `${username}@telegram`
            : `${telegramId}@telegram`;
        let [user] = await db
            .select()
            .from(users)
            .where(or(and(eq(users.provider, 'telegram'), eq(users.providerId, telegramId)), eq(users.email, email.toLowerCase())))
            .limit(1);
        if (!user) {
            const [newUser] = await db
                .insert(users)
                .values({
                email: email.toLowerCase(),
                name,
                image: photoUrl,
                provider: 'telegram',
                providerId: telegramId,
                role: 'user',
                generationsLeft: 5,
            })
                .returning();
            user = newUser;
        }
        else if (user.provider !== 'telegram') {
            await db
                .update(users)
                .set({
                provider: 'telegram',
                providerId: telegramId,
                image: user.image || photoUrl,
                name: user.name || name,
                updatedAt: new Date(),
            })
                .where(eq(users.id, user.id));
        }
        const accessToken = createAccessToken({
            userId: user.id,
            email: user.email,
            role: user.role,
        });
        const refreshToken = await createRefreshToken(user.id);
        setAuthCookies(res, { accessToken, refreshToken });
        logOAuthCallbackSuccess(req, user.id, user.email, 'telegram');
        return res.redirect(302, appUrl || '/');
    }
    catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logOAuthCallbackFailed(req, errorMessage, 'telegram');
        console.error('[Telegram Login] Callback error:', error);
        return res.redirect(302, `${appUrl}/login?error=authentication_failed`);
    }
});
export default router;
//# sourceMappingURL=auth.js.map