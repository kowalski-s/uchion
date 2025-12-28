import type { VercelRequest, VercelResponse } from '@vercel/node'
import NextAuth from 'next-auth'
import { authOptions } from '../_lib/auth/config'

const handler = async (req: any, res: any) => {
  // Ensure nextauth query param is an array
  const { nextauth } = req.query
  if (nextauth && !Array.isArray(nextauth)) {
    req.query.nextauth = [nextauth]
  }

  // Call NextAuth handler
  return await NextAuth(req, res, authOptions)
}

export default handler
