import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import { config } from './config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const { host, port, user, password, database } = config.db;

  const server = await mysql.createConnection({ host, port, user, password });
  await server.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  await server.end();

  const db = await mysql.createConnection({ host, port, user, password, database, multipleStatements: true });
  await db.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version VARCHAR(80) NOT NULL PRIMARY KEY,
       applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
     ) ENGINE=InnoDB`
  );

  const [appliedRows] = await db.query('SELECT version FROM schema_migrations');
  const applied = new Set(appliedRows.map(r => r.version));

  const dir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

  for (const f of files) {
    if (applied.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    console.log(`Applying ${f} ...`);
    await db.query(sql);
    await db.query('INSERT INTO schema_migrations (version) VALUES (?)', [f]);
  }

  console.log('Migrations up to date.');
  await db.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
