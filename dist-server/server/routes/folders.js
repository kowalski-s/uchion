import { Router } from 'express';
import { eq, and, isNull, asc, count } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../db/index.js';
import { folders, worksheets, subscriptions } from '../../db/schema.js';
import { withAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error-handler.js';
import { requireRateLimit } from '../middleware/rate-limit.js';
const router = Router();
const FOLDER_LIMITS = {
    free: 2,
    basic: 10,
    premium: 10,
};
const CreateFolderSchema = z.object({
    name: z.string().min(1).max(100),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366f1'),
    parentId: z.string().uuid().nullable().optional(),
});
const UpdateFolderSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
    parentId: z.string().uuid().nullable().optional(),
    sortOrder: z.number().int().min(0).optional(),
});
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ==================== GET /api/folders ====================
router.get('/', withAuth(async (req, res) => {
    const user = req.user;
    await requireRateLimit(req, {
        maxRequests: 60,
        windowSeconds: 60,
        identifier: `folders:list:${user.id}`,
    });
    const userFolders = await db
        .select({
        id: folders.id,
        name: folders.name,
        color: folders.color,
        parentId: folders.parentId,
        sortOrder: folders.sortOrder,
        createdAt: folders.createdAt,
    })
        .from(folders)
        .where(and(eq(folders.userId, user.id), isNull(folders.deletedAt)))
        .orderBy(asc(folders.sortOrder), asc(folders.createdAt));
    const worksheetCounts = await db
        .select({ folderId: worksheets.folderId })
        .from(worksheets)
        .where(and(eq(worksheets.userId, user.id), isNull(worksheets.deletedAt)));
    const countMap = new Map();
    for (const ws of worksheetCounts) {
        const key = ws.folderId;
        countMap.set(key, (countMap.get(key) || 0) + 1);
    }
    const foldersWithCount = userFolders.map(folder => ({
        ...folder,
        worksheetCount: countMap.get(folder.id) || 0,
    }));
    const rootWorksheetCount = countMap.get(null) || 0;
    return res.status(200).json({
        folders: foldersWithCount,
        rootWorksheetCount,
    });
}));
// ==================== POST /api/folders ====================
router.post('/', withAuth(async (req, res) => {
    const user = req.user;
    await requireRateLimit(req, {
        maxRequests: 20,
        windowSeconds: 60,
        identifier: `folders:create:${user.id}`,
    });
    const parse = CreateFolderSchema.safeParse(req.body);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { name, color, parentId } = parse.data;
    const [subscription] = await db
        .select({ plan: subscriptions.plan })
        .from(subscriptions)
        .where(eq(subscriptions.userId, user.id))
        .limit(1);
    const userPlan = subscription?.plan || 'free';
    const folderLimit = FOLDER_LIMITS[userPlan] || FOLDER_LIMITS.free;
    const [{ value: folderCount }] = await db
        .select({ value: count() })
        .from(folders)
        .where(and(eq(folders.userId, user.id), isNull(folders.deletedAt)));
    if (folderCount >= folderLimit) {
        throw new ApiError(403, 'Достигнут лимит папок', 'FOLDER_LIMIT_EXCEEDED', {
            message: userPlan === 'free'
                ? `Бесплатный тариф позволяет создать до ${folderLimit} папок.`
                : `Достигнут максимальный лимит папок (${folderLimit}).`,
            limit: folderLimit,
            current: folderCount,
        });
    }
    if (parentId) {
        const [parent] = await db
            .select({ userId: folders.userId })
            .from(folders)
            .where(and(eq(folders.id, parentId), isNull(folders.deletedAt)))
            .limit(1);
        if (!parent) {
            throw ApiError.badRequest('Parent folder not found');
        }
        if (parent.userId !== user.id) {
            throw ApiError.forbidden('Parent folder access denied');
        }
    }
    const [maxOrder] = await db
        .select({ maxSort: folders.sortOrder })
        .from(folders)
        .where(and(eq(folders.userId, user.id), isNull(folders.deletedAt), parentId ? eq(folders.parentId, parentId) : isNull(folders.parentId)))
        .orderBy(asc(folders.sortOrder))
        .limit(1);
    const nextSortOrder = (maxOrder?.maxSort || 0) + 1;
    const [newFolder] = await db
        .insert(folders)
        .values({
        userId: user.id,
        name,
        color,
        parentId: parentId || null,
        sortOrder: nextSortOrder,
    })
        .returning({
        id: folders.id,
        name: folders.name,
        color: folders.color,
        parentId: folders.parentId,
        sortOrder: folders.sortOrder,
        createdAt: folders.createdAt,
    });
    return res.status(201).json({
        folder: {
            ...newFolder,
            worksheetCount: 0,
        }
    });
}));
// ==================== GET /api/folders/:id ====================
router.get('/:id', withAuth(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id || !uuidRegex.test(id)) {
        throw ApiError.badRequest('Invalid folder ID format');
    }
    await requireRateLimit(req, {
        maxRequests: 60,
        windowSeconds: 60,
        identifier: `folders:get:${user.id}`,
    });
    const [folder] = await db
        .select({
        id: folders.id,
        userId: folders.userId,
        name: folders.name,
        color: folders.color,
        parentId: folders.parentId,
        sortOrder: folders.sortOrder,
        createdAt: folders.createdAt,
    })
        .from(folders)
        .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
        .limit(1);
    if (!folder) {
        throw ApiError.notFound('Folder not found');
    }
    if (folder.userId !== user.id) {
        throw ApiError.forbidden('Access denied');
    }
    const folderWorksheets = await db
        .select({
        id: worksheets.id,
        title: worksheets.title,
        subject: worksheets.subject,
        grade: worksheets.grade,
        topic: worksheets.topic,
        createdAt: worksheets.createdAt,
    })
        .from(worksheets)
        .where(and(eq(worksheets.folderId, id), eq(worksheets.userId, user.id), isNull(worksheets.deletedAt)));
    return res.status(200).json({
        folder: {
            id: folder.id,
            name: folder.name,
            color: folder.color,
            parentId: folder.parentId,
            sortOrder: folder.sortOrder,
            createdAt: folder.createdAt,
            worksheetCount: folderWorksheets.length,
        },
        worksheets: folderWorksheets,
    });
}));
// ==================== PATCH /api/folders/:id ====================
router.patch('/:id', withAuth(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id || !uuidRegex.test(id)) {
        throw ApiError.badRequest('Invalid folder ID format');
    }
    await requireRateLimit(req, {
        maxRequests: 30,
        windowSeconds: 60,
        identifier: `folders:update:${user.id}`,
    });
    const parse = UpdateFolderSchema.safeParse(req.body);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const updates = parse.data;
    const [folder] = await db
        .select({ userId: folders.userId })
        .from(folders)
        .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
        .limit(1);
    if (!folder) {
        throw ApiError.notFound('Folder not found');
    }
    if (folder.userId !== user.id) {
        throw ApiError.forbidden('Access denied');
    }
    if (updates.parentId !== undefined && updates.parentId !== null) {
        if (updates.parentId === id) {
            throw ApiError.badRequest('Folder cannot be its own parent');
        }
        const [parent] = await db
            .select({ userId: folders.userId })
            .from(folders)
            .where(and(eq(folders.id, updates.parentId), isNull(folders.deletedAt)))
            .limit(1);
        if (!parent) {
            throw ApiError.badRequest('Parent folder not found');
        }
        if (parent.userId !== user.id) {
            throw ApiError.forbidden('Parent folder access denied');
        }
    }
    const updateData = {
        updatedAt: new Date(),
    };
    if (updates.name !== undefined)
        updateData.name = updates.name;
    if (updates.color !== undefined)
        updateData.color = updates.color;
    if (updates.parentId !== undefined)
        updateData.parentId = updates.parentId;
    if (updates.sortOrder !== undefined)
        updateData.sortOrder = updates.sortOrder;
    await db
        .update(folders)
        .set(updateData)
        .where(eq(folders.id, id));
    return res.status(200).json({ success: true });
}));
// ==================== DELETE /api/folders/:id ====================
router.delete('/:id', withAuth(async (req, res) => {
    const user = req.user;
    const { id } = req.params;
    if (!id || !uuidRegex.test(id)) {
        throw ApiError.badRequest('Invalid folder ID format');
    }
    await requireRateLimit(req, {
        maxRequests: 10,
        windowSeconds: 60,
        identifier: `folders:delete:${user.id}`,
    });
    const [folder] = await db
        .select({ userId: folders.userId })
        .from(folders)
        .where(and(eq(folders.id, id), isNull(folders.deletedAt)))
        .limit(1);
    if (!folder) {
        throw ApiError.notFound('Folder not found');
    }
    if (folder.userId !== user.id) {
        throw ApiError.forbidden('Access denied');
    }
    // Move worksheets to root
    await db
        .update(worksheets)
        .set({ folderId: null, updatedAt: new Date() })
        .where(and(eq(worksheets.folderId, id), isNull(worksheets.deletedAt)));
    // Move child folders to root
    await db
        .update(folders)
        .set({ parentId: null, updatedAt: new Date() })
        .where(and(eq(folders.parentId, id), isNull(folders.deletedAt)));
    // Soft delete
    await db
        .update(folders)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(folders.id, id));
    return res.status(200).json({ success: true });
}));
export default router;
//# sourceMappingURL=folders.js.map