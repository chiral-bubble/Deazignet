import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const dbUrl = process.env.DATABASE_URL;

if (!dbUrl) {
  console.error('DATABASE_URL is not defined in .env');
  process.exit(1);
}

export async function runSql(sql: string) {
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();
  try {
    const res = await client.query(sql);
    return res;
  } finally {
    await client.end();
  }
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.log('Usage: npx tsx scripts/run-sql-migration.ts <path-to-sql-file>');
    process.exit(1);
  }

  const fullPath = path.resolve(process.cwd(), filePath);
  console.log(`Reading SQL from: ${fullPath}`);
  const sql = fs.readFileSync(fullPath, 'utf8');

  console.log(`Executing SQL migration (${sql.length} bytes)...`);
  const start = Date.now();
  await runSql(sql);
  console.log(`✅ Migration executed successfully in ${Date.now() - start}ms`);
}

if (process.argv[1]?.includes('run-sql-migration')) {
  main().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });
}

