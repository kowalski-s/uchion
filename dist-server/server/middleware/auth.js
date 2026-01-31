import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { getTokenFromCookie, ACCESS_TOKEN_COOKIE } from './cookies.js';
import { verifyAccessToken } from '../../api/_lib/auth/tokens.js';
/**
 * Middleware that requires authentication
 * Returns 401 if user is not authenticated
 */
export function withAuth(handler) {
    return async (req, res) => {
        try {
            const token = getTokenFromCookie(req, ACCESS_TOKEN_COOKIE);
            if (!token) {
                return res.status(401).json({ error: 'Authentication required' });
            }
            const payload = verifyAccessToken(token);
            if (!payload) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
            // Verify user still exists in database and is not deleted
            const [user] = await db
                .select({
                id: users.id,
                email: users.email,
                name: users.name,
                role: users.role,
            })
                .from(users)
                .where(and(eq(users.id, payload.sub), isNull(users.deletedAt)))
                .limit(1);
            if (!user) {
                return res.status(401).json({ error: 'User not found or deactivated' });
            }
            // Attach user to request
            ;
            req.user = user;
            return await handler(req, res);
        }
        catch (error) {
            console.error('[Auth Middleware] Error:', error);
            return res.status(500).json({ error: 'Internal server error' });
        }
    };
}
/**
 * Middleware that requires admin role
 * Returns 403 if user is not admin
 */
export function withAdminAuth(handler) {
    return withAuth(async (req, res) => {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }
        return await handler(req, res);
    });
}
//# sourceMappingURL=auth.js.map