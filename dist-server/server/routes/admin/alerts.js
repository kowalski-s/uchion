import { Router } from 'express';
import { z } from 'zod';
import { withAdminAuth } from '../../middleware/auth.js';
import { ApiError } from '../../middleware/error-handler.js';
import { checkRateLimit } from '../../middleware/rate-limit.js';
import { sendAdminAlert } from '../../../api/_lib/telegram/index.js';
import { getAlertMetrics, simulateGenerations, resetAlertState, resetCooldowns, trackGeneration, trackAICall, checkValidationScore, } from '../../../api/_lib/alerts/generation-alerts.js';
const router = Router();
// ==================== POST /api/admin/test-alert ====================
const TestAlertSchema = z.object({
    level: z.enum(['info', 'warning', 'critical']).default('info'),
    message: z.string().min(1).max(500).optional(),
});
router.post('/test-alert', withAdminAuth(async (req, res) => {
    const rateLimitResult = await checkRateLimit(req, {
        maxRequests: 5,
        windowSeconds: 60,
        identifier: `admin:test-alert:${req.user.id}`,
    });
    if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000);
        throw ApiError.tooManyRequests('Too many requests', retryAfter);
    }
    const parse = TestAlertSchema.safeParse(req.body);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { level, message } = parse.data;
    const alertLevel = level;
    const testMessage = message || `Тестовый алерт от ${req.user.email}\n\nВремя: ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })}`;
    console.log(`[Admin Test Alert] Sending ${alertLevel} alert from ${req.user.email}`);
    const result = await sendAdminAlert({
        message: testMessage,
        level: alertLevel,
    });
    console.log(`[Admin Test Alert] Result: sent to ${result.sentCount} admins, success: ${result.success}`);
    return res.status(200).json({
        success: result.success,
        sentCount: result.sentCount,
        message: result.sentCount > 0
            ? `Алерт отправлен ${result.sentCount} админам`
            : 'Нет подписанных админов для отправки',
    });
}));
// ==================== GET /api/admin/alerts/metrics ====================
router.get('/metrics', withAdminAuth(async (req, res) => {
    const metrics = getAlertMetrics();
    return res.status(200).json(metrics);
}));
// ==================== POST /api/admin/alerts/reset ====================
router.post('/reset', withAdminAuth(async (req, res) => {
    resetAlertState();
    console.log(`[Admin Alerts] State reset by ${req.user.email}`);
    return res.status(200).json({ success: true, message: 'Состояние алертов сброшено' });
}));
// ==================== POST /api/admin/alerts/reset-cooldowns ====================
router.post('/reset-cooldowns', withAdminAuth(async (req, res) => {
    resetCooldowns();
    console.log(`[Admin Alerts] Cooldowns reset by ${req.user.email}`);
    return res.status(200).json({ success: true, message: 'Cooldown алертов сброшен' });
}));
// ==================== POST /api/admin/alerts/test/error-rate ====================
const TestErrorRateSchema = z.object({
    totalGenerations: z.number().int().min(5).max(100).default(20),
    failRate: z.number().min(0).max(1).default(0.15),
});
router.post('/test/error-rate', withAdminAuth(async (req, res) => {
    const parse = TestErrorRateSchema.safeParse(req.body);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { totalGenerations, failRate } = parse.data;
    resetAlertState();
    simulateGenerations(totalGenerations, failRate);
    await trackGeneration(false);
    const metrics = getAlertMetrics();
    console.log(`[Admin Alerts Test] Error rate test by ${req.user.email}: ${totalGenerations} generations, ${failRate * 100}% fail rate`);
    return res.status(200).json({
        success: true,
        message: `Симулировано ${totalGenerations} генераций с ${(failRate * 100).toFixed(1)}% ошибок`,
        metrics,
    });
}));
// ==================== POST /api/admin/alerts/test/timeout ====================
const TestTimeoutSchema = z.object({
    consecutiveTimeouts: z.number().int().min(1).max(10).default(3),
});
router.post('/test/timeout', withAdminAuth(async (req, res) => {
    const parse = TestTimeoutSchema.safeParse(req.body);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { consecutiveTimeouts } = parse.data;
    resetAlertState();
    for (let i = 0; i < consecutiveTimeouts; i++) {
        await trackAICall({ success: false, isTimeout: true });
    }
    const metrics = getAlertMetrics();
    console.log(`[Admin Alerts Test] Timeout test by ${req.user.email}: ${consecutiveTimeouts} consecutive timeouts`);
    return res.status(200).json({
        success: true,
        message: `Симулировано ${consecutiveTimeouts} таймаутов подряд`,
        metrics,
    });
}));
// ==================== POST /api/admin/alerts/test/low-quality ====================
const TestLowQualitySchema = z.object({
    score: z.number().int().min(0).max(10).default(5),
    topic: z.string().min(1).max(200).default('Тестовая тема'),
    subject: z.enum(['math', 'algebra', 'geometry', 'russian']).default('math'),
    grade: z.number().int().min(1).max(4).default(3),
});
router.post('/test/low-quality', withAdminAuth(async (req, res) => {
    const parse = TestLowQualitySchema.safeParse(req.body);
    if (!parse.success) {
        throw ApiError.validation(parse.error.flatten().fieldErrors);
    }
    const { score, topic, subject, grade } = parse.data;
    await checkValidationScore({ score, topic, subject, grade });
    console.log(`[Admin Alerts Test] Low quality test by ${req.user.email}: score=${score}, topic=${topic}`);
    return res.status(200).json({
        success: true,
        message: score < 8
            ? `Отправлен алерт о низком качестве (score: ${score}/10)`
            : `Score ${score}/10 выше порога (8), алерт не отправлен`,
        params: { score, topic, subject, grade },
    });
}));
export default router;
//# sourceMappingURL=alerts.js.map