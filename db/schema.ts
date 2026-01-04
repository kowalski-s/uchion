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

// ==================== FOLDERS TABLE ====================

export const folders = pgTable('folders', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 100 }).notNull(),
  color: varchar('color', { length: 7 }).default('#6366f1'), // HEX color for folder icon
  parentId: uuid('parent_id'), // Self-reference for nested folders (optional)
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (table) => ({
  userIdIdx: index('folders_user_id_idx').on(table.userId),
  parentIdIdx: index('folders_parent_id_idx').on(table.parentId),
  deletedAtIdx: index('folders_deleted_at_idx').on(table.deletedAt),
}))

// ==================== WORKSHEETS TABLE ====================

export const worksheets = pgTable('worksheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  folderId: uuid('folder_id').references(() => folders.id, { onDelete: 'set null' }), // Optional folder
  title: varchar('title', { length: 200 }), // Custom user title (null = auto-generated from topic)
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
  folderIdIdx: index('worksheets_folder_id_idx').on(table.folderId),
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
  folders: many(folders),
  generations: many(generations),
  subscription: one(subscriptions),
  payments: many(payments),
  refreshTokens: many(refreshTokens),
}))

export const foldersRelations = relations(folders, ({ one, many }) => ({
  user: one(users, {
    fields: [folders.userId],
    references: [users.id],
  }),
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'parentFolder',
  }),
  children: many(folders, { relationName: 'parentFolder' }),
  worksheets: many(worksheets),
}))

export const worksheetsRelations = relations(worksheets, ({ one }) => ({
  user: one(users, {
    fields: [worksheets.userId],
    references: [users.id],
  }),
  folder: one(folders, {
    fields: [worksheets.folderId],
    references: [folders.id],
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
