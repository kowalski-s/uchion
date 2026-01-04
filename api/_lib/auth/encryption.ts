import crypto from 'crypto'

/**
 * AES-256-GCM encryption for sensitive data at rest
 *
 * Uses ENCRYPTION_KEY environment variable (must be 32+ characters)
 * Format: base64(iv:ciphertext:authTag)
 */

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12  // GCM standard
const AUTH_TAG_LENGTH = 16

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY
  if (!key || key.length < 32) {
    throw new Error('ENCRYPTION_KEY must be at least 32 characters')
  }
  // Use first 32 bytes of the key (256 bits for AES-256)
  return crypto.createHash('sha256').update(key).digest()
}

/**
 * Encrypt a plaintext string
 * @returns Base64 encoded string in format: iv:ciphertext:authTag
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) {
    return ''
  }

  const key = getEncryptionKey()
  const iv = crypto.randomBytes(IV_LENGTH)

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8')
  encrypted = Buffer.concat([encrypted, cipher.final()])

  const authTag = cipher.getAuthTag()

  // Combine iv + ciphertext + authTag and encode as base64
  const combined = Buffer.concat([iv, encrypted, authTag])
  return combined.toString('base64')
}

/**
 * Decrypt an encrypted string
 * @param encryptedData Base64 encoded string from encrypt()
 * @returns Decrypted plaintext or null if decryption fails
 */
export function decrypt(encryptedData: string): string | null {
  if (!encryptedData) {
    return null
  }

  try {
    const key = getEncryptionKey()
    const combined = Buffer.from(encryptedData, 'base64')

    // Extract iv, ciphertext, and authTag
    const iv = combined.subarray(0, IV_LENGTH)
    const authTag = combined.subarray(combined.length - AUTH_TAG_LENGTH)
    const ciphertext = combined.subarray(IV_LENGTH, combined.length - AUTH_TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    let decrypted = decipher.update(ciphertext)
    decrypted = Buffer.concat([decrypted, decipher.final()])

    return decrypted.toString('utf8')
  } catch (error) {
    console.error('[Encryption] Decryption failed:', error)
    return null
  }
}

/**
 * Check if a string looks like encrypted data
 * (starts with base64 and has expected length)
 */
export function isEncrypted(data: string): boolean {
  if (!data) return false

  try {
    const decoded = Buffer.from(data, 'base64')
    // Minimum length: IV (12) + at least 1 byte + authTag (16) = 29 bytes
    return decoded.length >= IV_LENGTH + 1 + AUTH_TAG_LENGTH
  } catch {
    return false
  }
}

/**
 * Encrypt email for storage
 * Returns encrypted value, or original if already encrypted
 */
export function encryptEmail(email: string): string {
  if (!email) return ''
  if (isEncrypted(email)) return email
  return encrypt(email.toLowerCase())
}

/**
 * Decrypt email for use
 * Returns decrypted value, or original if not encrypted
 */
export function decryptEmail(encryptedEmail: string): string {
  if (!encryptedEmail) return ''
  if (!isEncrypted(encryptedEmail)) return encryptedEmail
  return decrypt(encryptedEmail) || encryptedEmail
}

/**
 * Encrypt provider ID for storage
 */
export function encryptProviderId(providerId: string): string {
  if (!providerId) return ''
  if (isEncrypted(providerId)) return providerId
  return encrypt(providerId)
}

/**
 * Decrypt provider ID for use
 */
export function decryptProviderId(encryptedProviderId: string): string {
  if (!encryptedProviderId) return ''
  if (!isEncrypted(encryptedProviderId)) return encryptedProviderId
  return decrypt(encryptedProviderId) || encryptedProviderId
}

/**
 * Create a searchable hash of an email for lookups
 * This allows searching by email without exposing the plaintext
 */
export function hashEmail(email: string): string {
  if (!email) return ''
  const key = getEncryptionKey()
  return crypto
    .createHmac('sha256', key)
    .update(email.toLowerCase())
    .digest('hex')
}
