import { Router } from 'express';
const router = Router();
// ==================== GET /api/health ====================
router.get('/health', (_req, res) => {
    return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        message: 'Backend API is running!'
    });
});
// ==================== GET /api/pdf ====================
// PDF generation is now client-side only
router.get('/pdf', (_req, res) => {
    return res.status(405).json({ error: 'PDF generation is client-side only now' });
});
export default router;
//# sourceMappingURL=health.js.map