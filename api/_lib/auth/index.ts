// Export auth configuration
export { authOptions } from './config'
export { authAdapter } from './adapter'

// Export password utilities
export { hashPassword, verifyPassword } from './password'

// Export middleware
export { withAuth, withAdminAuth } from './middleware'
export type { AuthenticatedHandler } from './middleware'
