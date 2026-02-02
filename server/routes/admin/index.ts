import { Router } from 'express'
import statsRouter from './stats.js'
import usersRouter from './users.js'
import generationsRouter, { generationLogsRouter } from './generations.js'
import paymentsRouter from './payments.js'
import alertsRouter from './alerts.js'

const router = Router()

router.use('/stats', statsRouter)
router.use('/users', usersRouter)
router.use('/generations', generationsRouter)
router.use('/generation-logs', generationLogsRouter)
router.use('/payments', paymentsRouter)
router.use('/alerts', alertsRouter)
// /test-alert is handled by alertsRouter at root level
router.use('/', alertsRouter)

export default router
