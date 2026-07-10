// การเชื่อมต่อ PostgreSQL (pg) — เก็บข้อมูลทั้งหมดของแอปไว้ที่นี่
// รัน Postgres ผ่าน docker compose (ดู docker-compose.yml ที่ root)
const { Pool } = require('pg');

// ต่อกับ Postgres ใน docker เป็นค่า default — ตั้ง DATABASE_URL เพื่อ override ได้
const connectionString =
  process.env.DATABASE_URL ||
  'postgres://billsplit:billsplit@localhost:5432/billsplit';

// cloud Postgres ส่วนใหญ่บังคับ SSL; local docker ไม่ต้อง — ตั้ง PGSSL=require เพื่อเปิด
const ssl = process.env.PGSSL === 'require' ? { rejectUnauthorized: false } : false;

const pool = new Pool({ connectionString, ssl });

const num = (v) => (v == null ? v : Number(v)); // NUMERIC ของ pg คืนมาเป็น string -> แปลงเป็นเลข

// สร้างตารางทั้งหมดถ้ายังไม่มี (รันตอน server เริ่มทำงาน)
async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS people (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      name TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount NUMERIC(12,2) NOT NULL,
      all_members BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS expense_payers (
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE,
      paid NUMERIC(12,2) NOT NULL
    );

    CREATE TABLE IF NOT EXISTS expense_participants (
      expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
      person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
    CREATE INDEX IF NOT EXISTS idx_people_bill ON people(bill_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_bill ON expenses(bill_id);
  `);
}

module.exports = { pool, init, num };
