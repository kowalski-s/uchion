import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  console.log('[HEALTH] Health check endpoint called')

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'Backend API is running!'
  })
}
