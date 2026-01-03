import { pgTable, text, timestamp, uuid, integer, varchar, boolean, pgEnum, index } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ==================== ENUMS ====================

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'basic', 'premium'])
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'expired', 'trial'])
export const generationStatusEnum = pgEnum('generation_status', ['pending', 'processing', 'completed', 'failed'])
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded'])
export const subjectEnum = pgEnum('subject', ['math', 'russian'])
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard'])

// ==================== USERS TABLE ====================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('user'),
  generationsLeft: integer('generations_left').notNull().default(3),
  // OAuth provider info
  provider: varchar('provider', { length: 50 }),  // 'yandex' | 'telegram'
  providerId: varchar('provider_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  deletedAtIdx: index('users_deleted_at_idx').on(table.deletedAt),
  providerIdx: index('users_provider_idx').on(table.provider, table.providerId),
}))

// ==================== WORKSHEETS TABLE ====================

export const worksheets = pgTable('worksheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  subject: subjectEnum('subject').notNull(),
  grade: integer('grade').notNull(), // 1-4
  topic: varchar('topic', { length: 500 }).notNull(),
  difficulty: difficultyEnum('difficulty').notNull().default('medium'),
  content: text('content').notNull(), // JSON string with worksheet structure
  pdfUrl: text('pdf_url'),
  docxUrl: text('docx_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: index('worksheets_user_id_idx').on(table.userId),
  subjectIdx: index('worksheets_subject_idx').on(table.subject),
  gradeIdx: index('worksheets_grade_idx').on(table.grade),
  createdAtIdx: index('worksheets_created_at_idx').on(table.createdAt),
  deletedAtIdx: index('worksheets_deleted_at_idx').on(table.deletedAt),
}))

// ==================== GENERATIONS TABLE ====================

export const generations = pgTable('generations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  worksheetId: uuid('worksheet_id').references(() => worksheets.id, { onDelete: 'set null' }),
  status: generationStatusEnum('status').notNull().default('pending'),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('generations_user_id_idx').on(table.userId),
  statusIdx: index('generations_status_idx').on(table.status),
  createdAtIdx: index('generations_created_at_idx').on(table.createdAt),
}))

// ==================== SUBSCRIPTIONS TABLE ====================

export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),
  plan: subscriptionPlanEnum('plan').notNull().default('free'),
  status: subscriptionStatusEnum('status').notNull().default('active'),
  expiresAt: timestamp('expires_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('subscriptions_user_id_idx').on(table.userId),
  statusIdx: index('subscriptions_status_idx').on(table.status),
  expiresAtIdx: index('subscriptions_expires_at_idx').on(table.expiresAt),
}))

// ==================== PAYMENTS TABLE ====================

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(), // Amount in kopecks (rubles * 100)
  status: paymentStatusEnum('status').notNull().default('pending'),
  providerPaymentId: varchar('provider_payment_id', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('payments_user_id_idx').on(table.userId),
  statusIdx: index('payments_status_idx').on(table.status),
  createdAtIdx: index('payments_created_at_idx').on(table.createdAt),
}))

// ==================== REFRESH TOKENS TABLE ====================

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jti: varchar('jti', { length: 255 }).notNull().unique(),  // JWT ID for token tracking
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
  jtiIdx: index('refresh_tokens_jti_idx').on(table.jti),
}))

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many, one }) => ({
  worksheets: many(worksheets),
  generations: many(generations),
  subscription: one(subscriptions),
  payments: many(payments),
  refreshTokens: many(refreshTokens),
}))

export const worksheetsRelations = relations(worksheets, ({ one }) => ({
  user: one(users, {
    fields: [worksheets.userId],
    references: [users.id],
  }),
  generation: one(generations, {
    fields: [worksheets.id],
    references: [generations.worksheetId],
  }),
}))

export const generationsRelations = relations(generations, ({ one }) => ({
  user: one(users, {
    fields: [generations.userId],
    references: [users.id],
  }),
  worksheet: one(worksheets, {
    fields: [generations.worksheetId],
    references: [worksheets.id],
  }),
}))

export const subscriptionsRelations = relations(subscriptions, ({ one }) => ({
  user: one(users, {
    fields: [subscriptions.userId],
    references: [users.id],
  }),
}))

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
}))

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}))
