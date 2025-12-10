import type { VercelRequest, VercelResponse } from '@vercel/node'

export const config = {
  runtime: 'nodejs',
}

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  res.status(405).json({ error: 'PDF generation is client-side only now' })
}
