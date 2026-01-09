import { Router } from 'express';
import { eq, and, isNull, isNotNull, desc, sql, count, like, or, gte, inArray, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { users, worksheets, generations, subscriptions, payments } from '../../db/schema.js';
import { withAdminAuth } from '../middleware/auth.js';
import { checkRateLimit } from '../middleware/rate-limit.js';
const router = Router();
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ==================== GET /api/admin/stats ====================
// Получение общей статистики для главной страницы админки
router.get('/stats', withAdminAuth(async (req, res) => {
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:stats:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    try {
        // Общее количество пользователей (не удаленных)
        const [totalUsersResult] = await db
            .select({ count: count() })
            .from(users)
            .where(isNull(users.deletedAt));
        // Генерации за сегодня (считаем из worksheets - там хранятся сохраненные листы)
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const [todayWorksheetsResult] = await db
            .select({ count: count() })
            .from(worksheets)
            .where(and(gte(worksheets.createdAt, todayStart), isNull(worksheets.deletedAt)));
        // Также считаем из generations для полноты
        const [todayGenerationsResult] = await db
            .select({ count: count() })
            .from(generations)
            .where(gte(generations.createdAt, todayStart));
        // Активные подписки (не free)
        const [activeSubscriptionsResult] = await db
            .select({ count: count() })
            .from(subscriptions)
            .where(and(eq(subscriptions.status, 'active'), sql `${subscriptions.plan} != 'free'`));
        // Всего генераций (считаем из worksheets)
        const [totalWorksheetsResult] = await db
            .select({ count: count() })
            .from(worksheets)
            .where(isNull(worksheets.deletedAt));
        const [totalGenerationsResult] = await db
            .select({ count: count() })
            .from(generations);
        // Используем максимум из двух источников
        const todayCount = Math.max(todayWorksheetsResult.count, todayGenerationsResult.count);
        const totalCount = Math.max(totalWorksheetsResult.count, totalGenerationsResult.count);
        return res.status(200).json({
            stats: {
                totalUsers: totalUsersResult.count,
                todayGenerations: todayCount,
                activeSubscriptions: activeSubscriptionsResult.count,
                totalGenerations: totalCount,
            }
        });
    }
    catch (error) {
        console.error('[Admin Stats] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
// ==================== GET /api/admin/users ====================
// Список всех пользователей с пагинацией и поиском
const UsersQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    search: z.string().optional(),
    status: z.enum(['all', 'active', 'blocked']).optional().default('active'),
    sortBy: z.enum(['createdAt', 'email', 'name']).optional().default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});
router.get('/users', withAdminAuth(async (req, res) => {
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:users:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    const parse = UsersQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Validation error',
            details: parse.error.flatten().fieldErrors,
        });
    }
    const { page, limit, search, status, sortBy, sortOrder } = parse.data;
    const offset = (page - 1) * limit;
    try {
        // Базовые условия в зависимости от статуса
        const conditions = [];
        // Фильтр по статусу блокировки
        if (status === 'active') {
            conditions.push(isNull(users.deletedAt));
        }
        else if (status === 'blocked') {
            conditions.push(isNotNull(users.deletedAt));
        }
        // status === 'all' - не добавляем условие на deletedAt
        // Поиск по email, name или providerId
        if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            conditions.push(or(like(users.email, searchPattern), like(users.name, searchPattern), like(users.providerId, searchPattern)));
        }
        // Общее количество для пагинации
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const [totalResult] = await db
            .select({ count: count() })
            .from(users)
            .where(whereClause);
        // Получаем пользователей с количеством генераций
        // Определяем порядок сортировки
        const getSortColumn = () => {
            switch (sortBy) {
                case 'email': return users.email;
                case 'name': return users.name;
                default: return users.createdAt;
            }
        };
        const sortColumn = getSortColumn();
        const usersList = await db
            .select({
            id: users.id,
            email: users.email,
            name: users.name,
            image: users.image,
            role: users.role,
            provider: users.provider,
            providerId: users.providerId,
            generationsLeft: users.generationsLeft,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            deletedAt: users.deletedAt,
        })
            .from(users)
            .where(whereClause)
            .orderBy(sortOrder === 'desc' ? desc(sortColumn) : asc(sortColumn))
            .limit(limit)
            .offset(offset);
        // Получаем количество генераций И worksheets для каждого пользователя
        const userIds = usersList.map(u => u.id);
        let generationCounts = {};
        let worksheetCounts = {};
        if (userIds.length > 0) {
            // Подсчет из таблицы generations
            const genCountsResult = await db
                .select({
                userId: generations.userId,
                count: count(),
            })
                .from(generations)
                .where(inArray(generations.userId, userIds))
                .groupBy(generations.userId);
            generationCounts = genCountsResult.reduce((acc, row) => {
                acc[row.userId] = row.count;
                return acc;
            }, {});
            // Подсчет из таблицы worksheets (сохраненные листы)
            const worksheetCountsResult = await db
                .select({
                userId: worksheets.userId,
                count: count(),
            })
                .from(worksheets)
                .where(and(inArray(worksheets.userId, userIds), isNull(worksheets.deletedAt)))
                .groupBy(worksheets.userId);
            worksheetCounts = worksheetCountsResult.reduce((acc, row) => {
                acc[row.userId] = row.count;
                return acc;
            }, {});
        }
        // Добавляем количество генераций к каждому пользователю
        // Используем max из generations и worksheets для более точного подсчета
        const usersWithCounts = usersList.map(user => ({
            ...user,
            isBlocked: user.deletedAt !== null,
            generationsCount: Math.max(generationCounts[user.id] || 0, worksheetCounts[user.id] || 0),
            worksheetsCount: worksheetCounts[user.id] || 0,
        }));
        return res.status(200).json({
            users: usersWithCounts,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                totalPages: Math.ceil(totalResult.count / limit),
            }
        });
    }
    catch (error) {
        console.error('[Admin Users] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
// ==================== GET /api/admin/users/:id ====================
// Детальная информация о пользователе
router.get('/users/:id', withAdminAuth(async (req, res) => {
    const { id } = req.params;
    if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 60,
        windowSeconds: 60,
        identifier: `admin:user-detail:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    try {
        // Получаем пользователя
        const [user] = await db
            .select({
            id: users.id,
            email: users.email,
            name: users.name,
            image: users.image,
            role: users.role,
            provider: users.provider,
            providerId: users.providerId,
            generationsLeft: users.generationsLeft,
            createdAt: users.createdAt,
            updatedAt: users.updatedAt,
            deletedAt: users.deletedAt,
        })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        // Получаем подписку пользователя
        const [subscription] = await db
            .select({
            plan: subscriptions.plan,
            status: subscriptions.status,
            expiresAt: subscriptions.expiresAt,
        })
            .from(subscriptions)
            .where(eq(subscriptions.userId, id))
            .limit(1);
        // Получаем общее количество генераций из таблицы generations
        const [generationsCountResult] = await db
            .select({ count: count() })
            .from(generations)
            .where(eq(generations.userId, id));
        // Получаем количество сохраненных worksheets
        const [worksheetsCountResult] = await db
            .select({ count: count() })
            .from(worksheets)
            .where(and(eq(worksheets.userId, id), isNull(worksheets.deletedAt)));
        // Получаем последние 20 worksheets пользователя (более надежный способ)
        const userWorksheets = await db
            .select({
            id: worksheets.id,
            subject: worksheets.subject,
            grade: worksheets.grade,
            topic: worksheets.topic,
            title: worksheets.title,
            createdAt: worksheets.createdAt,
        })
            .from(worksheets)
            .where(and(eq(worksheets.userId, id), isNull(worksheets.deletedAt)))
            .orderBy(desc(worksheets.createdAt))
            .limit(20);
        // Также получаем генерации для совместимости
        const userGenerations = await db
            .select({
            id: generations.id,
            status: generations.status,
            errorMessage: generations.errorMessage,
            createdAt: generations.createdAt,
            worksheetId: generations.worksheetId,
            worksheetSubject: worksheets.subject,
            worksheetGrade: worksheets.grade,
            worksheetTopic: worksheets.topic,
        })
            .from(generations)
            .leftJoin(worksheets, eq(generations.worksheetId, worksheets.id))
            .where(eq(generations.userId, id))
            .orderBy(desc(generations.createdAt))
            .limit(20);
        // Используем большее из двух значений для отображения
        const totalGenerations = Math.max(generationsCountResult.count, worksheetsCountResult.count);
        return res.status(200).json({
            user: {
                ...user,
                isBlocked: user.deletedAt !== null,
                subscription: subscription || { plan: 'free', status: 'active', expiresAt: null },
                generationsCount: totalGenerations,
                worksheetsCount: worksheetsCountResult.count,
            },
            generations: userGenerations,
            worksheets: userWorksheets,
        });
    }
    catch (error) {
        console.error('[Admin User Detail] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
// ==================== POST /api/admin/users/:id/block ====================
// Блокировка пользователя (soft delete)
router.post('/users/:id/block', withAdminAuth(async (req, res) => {
    const { id } = req.params;
    if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }
    // Нельзя заблокировать самого себя
    if (id === req.user.id) {
        return res.status(400).json({ error: 'Cannot block yourself' });
    }
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 10,
        windowSeconds: 60,
        identifier: `admin:block-user:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    try {
        const [user] = await db
            .select({ id: users.id, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.deletedAt !== null) {
            return res.status(400).json({ error: 'User is already blocked' });
        }
        await db
            .update(users)
            .set({ deletedAt: new Date(), updatedAt: new Date() })
            .where(eq(users.id, id));
        console.log(`[Admin] User ${id} blocked by admin ${req.user.id}`);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[Admin Block User] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
// ==================== POST /api/admin/users/:id/unblock ====================
// Разблокировка пользователя
router.post('/users/:id/unblock', withAdminAuth(async (req, res) => {
    const { id } = req.params;
    if (!id || !uuidRegex.test(id)) {
        return res.status(400).json({ error: 'Invalid user ID format' });
    }
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 10,
        windowSeconds: 60,
        identifier: `admin:unblock-user:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    try {
        const [user] = await db
            .select({ id: users.id, deletedAt: users.deletedAt })
            .from(users)
            .where(eq(users.id, id))
            .limit(1);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        if (user.deletedAt === null) {
            return res.status(400).json({ error: 'User is not blocked' });
        }
        await db
            .update(users)
            .set({ deletedAt: null, updatedAt: new Date() })
            .where(eq(users.id, id));
        console.log(`[Admin] User ${id} unblocked by admin ${req.user.id}`);
        return res.status(200).json({ success: true });
    }
    catch (error) {
        console.error('[Admin Unblock User] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
// ==================== GET /api/admin/generations ====================
// Список всех сгенерированных листов (worksheets) с пагинацией и фильтрами
const GenerationsQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    subject: z.enum(['all', 'math', 'russian']).optional().default('all'),
    search: z.string().optional(), // Поиск по email пользователя или теме
});
// ==================== GET /api/admin/generation-logs ====================
// Логи генераций (из таблицы generations) - статусы, ошибки
const GenerationLogsQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    status: z.enum(['all', 'pending', 'processing', 'completed', 'failed']).optional().default('all'),
    search: z.string().optional(),
});
router.get('/generation-logs', withAdminAuth(async (req, res) => {
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:generation-logs:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    const parse = GenerationLogsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Validation error',
            details: parse.error.flatten().fieldErrors,
        });
    }
    const { page, limit, status, search } = parse.data;
    const offset = (page - 1) * limit;
    try {
        const conditions = [];
        if (status !== 'all') {
            conditions.push(eq(generations.status, status));
        }
        // Поиск по email пользователя
        if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            const matchedUsers = await db
                .select({ id: users.id })
                .from(users)
                .where(like(users.email, searchPattern))
                .limit(100);
            const userIds = matchedUsers.map(u => u.id);
            if (userIds.length === 0) {
                return res.status(200).json({
                    logs: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }
            conditions.push(inArray(generations.userId, userIds));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        // Общее количество
        const [totalResult] = await db
            .select({ count: count() })
            .from(generations)
            .where(whereClause);
        // Получаем логи с информацией о пользователе и листе
        const logsList = await db
            .select({
            id: generations.id,
            userId: generations.userId,
            userEmail: users.email,
            userName: users.name,
            worksheetId: generations.worksheetId,
            worksheetSubject: worksheets.subject,
            worksheetGrade: worksheets.grade,
            worksheetTopic: worksheets.topic,
            status: generations.status,
            errorMessage: generations.errorMessage,
            createdAt: generations.createdAt,
        })
            .from(generations)
            .leftJoin(users, eq(generations.userId, users.id))
            .leftJoin(worksheets, eq(generations.worksheetId, worksheets.id))
            .where(whereClause)
            .orderBy(desc(generations.createdAt))
            .limit(limit)
            .offset(offset);
        return res.status(200).json({
            logs: logsList,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                totalPages: Math.ceil(totalResult.count / limit),
            }
        });
    }
    catch (error) {
        console.error('[Admin Generation Logs] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
router.get('/generations', withAdminAuth(async (req, res) => {
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:generations:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    const parse = GenerationsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Validation error',
            details: parse.error.flatten().fieldErrors,
        });
    }
    const { page, limit, subject, search } = parse.data;
    const offset = (page - 1) * limit;
    try {
        // Условия фильтрации - только не удаленные листы
        const conditions = [isNull(worksheets.deletedAt)];
        // Фильтр по предмету
        if (subject !== 'all') {
            conditions.push(eq(worksheets.subject, subject));
        }
        // Если есть поиск - ищем по email пользователя или теме листа
        if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            // Ищем пользователей по email
            const matchedUsers = await db
                .select({ id: users.id })
                .from(users)
                .where(like(users.email, searchPattern))
                .limit(100);
            const userIds = matchedUsers.map(u => u.id);
            // Ищем по email ИЛИ по теме
            if (userIds.length > 0) {
                conditions.push(or(inArray(worksheets.userId, userIds), like(worksheets.topic, searchPattern)));
            }
            else {
                // Если пользователей не нашли - ищем только по теме
                conditions.push(like(worksheets.topic, searchPattern));
            }
        }
        const whereClause = and(...conditions);
        // Общее количество
        const [totalResult] = await db
            .select({ count: count() })
            .from(worksheets)
            .where(whereClause);
        // Получаем листы с информацией о пользователе
        const worksheetsList = await db
            .select({
            id: worksheets.id,
            userId: worksheets.userId,
            userEmail: users.email,
            userName: users.name,
            subject: worksheets.subject,
            grade: worksheets.grade,
            topic: worksheets.topic,
            title: worksheets.title,
            difficulty: worksheets.difficulty,
            createdAt: worksheets.createdAt,
        })
            .from(worksheets)
            .leftJoin(users, eq(worksheets.userId, users.id))
            .where(whereClause)
            .orderBy(desc(worksheets.createdAt))
            .limit(limit)
            .offset(offset);
        return res.status(200).json({
            generations: worksheetsList,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                totalPages: Math.ceil(totalResult.count / limit),
            }
        });
    }
    catch (error) {
        console.error('[Admin Generations] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
// ==================== GET /api/admin/payments ====================
// Список всех платежей с пагинацией и фильтрами
const PaymentsQuerySchema = z.object({
    page: z.string().optional().transform(v => Math.max(1, parseInt(v || '1'))),
    limit: z.string().optional().transform(v => Math.min(100, Math.max(1, parseInt(v || '20')))),
    status: z.enum(['all', 'pending', 'succeeded', 'failed', 'refunded']).optional().default('all'),
    search: z.string().optional(), // Поиск по email пользователя
});
router.get('/payments', withAdminAuth(async (req, res) => {
    const rateLimitResult = checkRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `admin:payments:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        return res
            .status(429)
            .setHeader('Retry-After', retryAfter.toString())
            .json({ error: 'Too many requests' });
    }
    const parse = PaymentsQuerySchema.safeParse(req.query);
    if (!parse.success) {
        return res.status(400).json({
            error: 'Validation error',
            details: parse.error.flatten().fieldErrors,
        });
    }
    const { page, limit, status, search } = parse.data;
    const offset = (page - 1) * limit;
    try {
        // Условия фильтрации
        const conditions = [];
        if (status !== 'all') {
            conditions.push(eq(payments.status, status));
        }
        // Если есть поиск - ищем по email пользователя
        let userIdsToFilter = null;
        if (search && search.trim()) {
            const searchPattern = `%${search.trim()}%`;
            const matchedUsers = await db
                .select({ id: users.id })
                .from(users)
                .where(like(users.email, searchPattern))
                .limit(100);
            userIdsToFilter = matchedUsers.map(u => u.id);
            if (userIdsToFilter.length === 0) {
                return res.status(200).json({
                    payments: [],
                    pagination: { page, limit, total: 0, totalPages: 0 }
                });
            }
            conditions.push(inArray(payments.userId, userIdsToFilter));
        }
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        // Общее количество
        const [totalResult] = await db
            .select({ count: count() })
            .from(payments)
            .where(whereClause);
        // Получаем платежи с информацией о пользователе
        const paymentsList = await db
            .select({
            id: payments.id,
            userId: payments.userId,
            userEmail: users.email,
            userName: users.name,
            amount: payments.amount,
            status: payments.status,
            providerPaymentId: payments.providerPaymentId,
            createdAt: payments.createdAt,
        })
            .from(payments)
            .leftJoin(users, eq(payments.userId, users.id))
            .where(whereClause)
            .orderBy(desc(payments.createdAt))
            .limit(limit)
            .offset(offset);
        return res.status(200).json({
            payments: paymentsList,
            pagination: {
                page,
                limit,
                total: totalResult.count,
                totalPages: Math.ceil(totalResult.count / limit),
            }
        });
    }
    catch (error) {
        console.error('[Admin Payments] Error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}));
export default router;
//# sourceMappingURL=admin.js.map