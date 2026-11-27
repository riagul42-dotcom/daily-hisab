// লোকাল ডেভেলপমেন্টের জন্য পোর্টেবল PostgreSQL চালু করে (ডেটা data/pg-তে থাকে)
require('dotenv').config();
const path = require('path');
const fs = require('fs');
const EmbeddedPostgres = require('embedded-postgres').default;

const DATA_DIR = process.env.PG_DATA_DIR
  ? path.resolve(process.env.PG_DATA_DIR)
  : path.join(__dirname, '..', 'data', 'pg');
const PORT = Number(process.env.PGPORT || 5433);
const DB_NAME = 'daily_hisab';

async function main() {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const pg = new EmbeddedPostgres({
    databaseDir: DATA_DIR,
    user: 'postgres',
    password: 'postgres',
    port: PORT,
    persistent: true,
    autoRehydrateSymlinks: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
  });

  try {
    await pg.initialise();
    console.log('✔ PostgreSQL ক্লাস্টার ইনিশিয়ালাইজ হয়েছে');
  } catch (err) {
    console.log('ℹ ইনিশিয়ালাইজ স্কিপ:', String(err.message || err).split('\n')[0]);
  }

  await pg.start();
  try {
    await pg.createDatabase(DB_NAME);
    console.log(`✔ ডেটাবেস তৈরি হয়েছে: ${DB_NAME}`);
  } catch (err) {
    console.log(`ℹ ডেটাবেস ${DB_NAME} আগেই আছে`);
  }

  console.log(`✔ PostgreSQL চলছে: 127.0.0.1:${PORT} (db: ${DB_NAME})`);

  const stop = async () => {
    console.log('PostgreSQL বন্ধ হচ্ছে...');
    try { await pg.stop(); } catch (_) { /* already stopped */ }
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((err) => {
  console.error('PostgreSQL চালু করা যায়নি:', err);
  process.exit(1);
});
