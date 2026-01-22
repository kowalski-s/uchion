import dotenv from 'dotenv';
import path from 'path';
// Load env files - .env.local takes priority over .env
const envLocalPath = path.resolve(process.cwd(), '.env.local');
console.log('[ENV] Loading from:', envLocalPath);
const result = dotenv.config({ path: envLocalPath, override: true });
console.log('[ENV] Loaded .env.local, AI_MODEL_GENERATION =', process.env.AI_MODEL_GENERATION);
dotenv.config({ path: '.env' });
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema.js';
if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
}
// Create postgres client
const client = postgres(process.env.DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
});
// Create drizzle instance
export const db = drizzle(client, { schema });
// Export schema for use in other files
export { schema };
//# sourceMappingURL=index.js.map