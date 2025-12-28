import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '../../../db/index.js'

export const authAdapter = DrizzleAdapter(db)
