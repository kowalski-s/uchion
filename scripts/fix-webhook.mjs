import postgres from 'postgres';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = postgres(process.env.DATABASE_URL);
const deleted = await sql`DELETE FROM webhook_events WHERE event_key LIKE 'sub:%'`;
console.log('Deleted:', deleted.count);
await sql.end();
process.exit(0);
