import { pgTable, text, timestamp, uuid, integer, varchar, boolean, pgEnum, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

// ==================== ENUMS ====================

export const userRoleEnum = pgEnum('user_role', ['user', 'admin'])
export const subscriptionPlanEnum = pgEnum('subscription_plan', ['free', 'basic', 'premium'])
export const subscriptionStatusEnum = pgEnum('subscription_status', ['active', 'canceled', 'expired', 'trial'])
export const generationStatusEnum = pgEnum('generation_status', ['pending', 'processing', 'completed', 'failed'])
export const paymentStatusEnum = pgEnum('payment_status', ['pending', 'succeeded', 'failed', 'refunded'])
export const paymentIntentStatusEnum = pgEnum('payment_intent_status', ['created', 'paid', 'failed', 'expired'])
export const subjectEnum = pgEnum('subject', ['math', 'algebra', 'geometry', 'russian'])
export const difficultyEnum = pgEnum('difficulty', ['easy', 'medium', 'hard'])
export const presentationThemeTypeEnum = pgEnum('presentation_theme_type', ['preset', 'custom'])
export const presentationThemePresetEnum = pgEnum('presentation_theme_preset', ['professional', 'educational', 'minimal', 'scientific'])

// ==================== USERS TABLE ====================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  name: varchar('name', { length: 255 }),
  image: text('image'),
  role: userRoleEnum('role').notNull().default('user'),
  generationsLeft: integer('generations_left').notNull().default(5),
  // OAuth provider info
  provider: varchar('provider', { length: 50 }),  // 'yandex' | 'telegram'
  providerId: varchar('provider_id', { length: 255 }),
  // Telegram alerts for admins
  telegramChatId: varchar('telegram_chat_id', { length: 50 }),  // Telegram chat ID for sending alerts
  wantsAlerts: boolean('wants_alerts').notNull().default(false),  // Flag: wants to receive alerts
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

// ==================== PAYMENT INTENTS TABLE ====================
// Tracks payment intents created for Prodamus or other providers

export const paymentIntents = pgTable('payment_intents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  productCode: varchar('product_code', { length: 100 }).notNull(), // e.g., 'generations_10', 'premium_monthly'
  amount: integer('amount').notNull(), // Amount in kopecks (rubles * 100)
  currency: varchar('currency', { length: 3 }).notNull().default('RUB'),
  status: paymentIntentStatusEnum('status').notNull().default('created'),
  provider: varchar('provider', { length: 50 }).notNull().default('prodamus'), // 'prodamus', etc.
  providerOrderId: varchar('provider_order_id', { length: 255 }).notNull().unique(), // Our order ID sent to provider
  providerPaymentId: varchar('provider_payment_id', { length: 255 }), // Provider's payment ID after success
  metadata: text('metadata'), // JSON string for extra data
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp('paid_at', { withTimezone: true }),
  expiresAt: timestamp('expires_at', { withTimezone: true }), // Payment link expiration
}, (table) => ({
  userIdIdx: index('payment_intents_user_id_idx').on(table.userId),
  statusIdx: index('payment_intents_status_idx').on(table.status),
  providerOrderIdIdx: index('payment_intents_provider_order_id_idx').on(table.providerOrderId),
  createdAtIdx: index('payment_intents_created_at_idx').on(table.createdAt),
}))

// ==================== WEBHOOK EVENTS TABLE ====================
// For idempotency - prevents duplicate webhook processing

export const webhookEvents = pgTable('webhook_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 50 }).notNull(), // 'prodamus', etc.
  eventKey: varchar('event_key', { length: 255 }).notNull(), // Unique event identifier from provider
  rawPayloadHash: varchar('raw_payload_hash', { length: 64 }).notNull(), // SHA-256 hash of raw payload
  processedAt: timestamp('processed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  providerEventKeyIdx: uniqueIndex('webhook_events_provider_event_key_idx').on(table.provider, table.eventKey),
  processedAtIdx: index('webhook_events_processed_at_idx').on(table.processedAt),
}))

// ==================== REFRESH TOKENS TABLE ====================

export const refreshTokens = pgTable('refresh_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  jti: varchar('jti', { length: 255 }).notNull().unique(),  // JWT ID for token tracking
  familyId: varchar('family_id', { length: 255 }).notNull(), // Token family for theft detection
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  revokedAt: timestamp('revoked_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
  jtiIdx: index('refresh_tokens_jti_idx').on(table.jti),
  familyIdIdx: index('refresh_tokens_family_id_idx').on(table.familyId),
}))

// ==================== PRESENTATIONS TABLE ====================

export const presentations = pgTable('presentations', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: varchar('title', { length: 300 }).notNull(),
  subject: subjectEnum('subject').notNull(),
  grade: integer('grade').notNull(),
  topic: varchar('topic', { length: 500 }).notNull(),
  themeType: presentationThemeTypeEnum('theme_type').notNull(),
  themePreset: presentationThemePresetEnum('theme_preset'),
  themeCustom: varchar('theme_custom', { length: 100 }),
  slideCount: integer('slide_count').notNull().default(10),
  structure: text('structure').notNull(), // JSON string
  pptxBase64: text('pptx_base64'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('presentations_user_id_idx').on(table.userId),
  subjectIdx: index('presentations_subject_idx').on(table.subject),
  createdAtIdx: index('presentations_created_at_idx').on(table.createdAt),
}))

// ==================== RELATIONS ====================

export const usersRelations = relations(users, ({ many, one }) => ({
  worksheets: many(worksheets),
  folders: many(folders),
  generations: many(generations),
  presentations: many(presentations),
  subscription: one(subscriptions),
  payments: many(payments),
  paymentIntents: many(paymentIntents),
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

export const paymentIntentsRelations = relations(paymentIntents, ({ one }) => ({
  user: one(users, {
    fields: [paymentIntents.userId],
    references: [users.id],
  }),
}))

export const presentationsRelations = relations(presentations, ({ one }) => ({
  user: one(users, {
    fields: [presentations.userId],
    references: [users.id],
  }),
}))
