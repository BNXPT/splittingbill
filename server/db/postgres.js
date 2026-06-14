// Adapter: PostgreSQL (pg) — ใช้ตอน deploy บน cloud เช่น Render
// ข้อมูลถาวร ไม่หายเวลา server restart
// เลือก adapter นี้อัตโนมัติเมื่อมี environment variable DATABASE_URL
const { Pool } = require('pg');

// cloud Postgres ส่วนใหญ่บังคับ SSL — เปิดให้อัตโนมัติ
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === 'disable' ? false : { rejectUnauthorized: false },
});

const num = (v) => (v == null ? v : Number(v)); // NUMERIC ของ pg คืนมาเป็น string -> แปลงเป็นเลข

module.exports = {
  async init() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS people (
        id SERIAL PRIMARY KEY, name TEXT NOT NULL );
      CREATE TABLE IF NOT EXISTS expenses (
        id SERIAL PRIMARY KEY, description TEXT NOT NULL,
        amount NUMERIC(12,2) NOT NULL, created_at TIMESTAMPTZ DEFAULT now() );
      CREATE TABLE IF NOT EXISTS expense_payers (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE, paid NUMERIC(12,2) NOT NULL );
      CREATE TABLE IF NOT EXISTS expense_participants (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE );
    `);
  },

  async listPeople() {
    const { rows } = await pool.query('SELECT id, name FROM people ORDER BY id');
    return rows;
  },
  async addPerson(name) {
    const { rows } = await pool.query('INSERT INTO people (name) VALUES ($1) RETURNING id, name', [name]);
    return rows[0];
  },
  async deletePerson(id) {
    await pool.query('DELETE FROM people WHERE id = $1', [id]);
  },

  async listExpenses() {
    const { rows: expenses } = await pool.query('SELECT * FROM expenses ORDER BY id DESC');
    const out = [];
    for (const e of expenses) {
      const { rows: payers } = await pool.query(
        `SELECT ep.person_id, ep.paid, pe.name FROM expense_payers ep
         JOIN people pe ON pe.id = ep.person_id WHERE ep.expense_id = $1`, [e.id]);
      const { rows: participants } = await pool.query(
        `SELECT epa.person_id, pe.name FROM expense_participants epa
         JOIN people pe ON pe.id = epa.person_id WHERE epa.expense_id = $1`, [e.id]);
      out.push({
        ...e,
        amount: num(e.amount),
        payers: payers.map((p) => ({ ...p, paid: num(p.paid) })),
        participants,
      });
    }
    return out;
  },
  async addExpense({ description, amount, payers, participants }) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query(
        'INSERT INTO expenses (description, amount) VALUES ($1, $2) RETURNING id', [description, amount]);
      const eid = rows[0].id;
      for (const p of payers)
        await client.query('INSERT INTO expense_payers (expense_id, person_id, paid) VALUES ($1,$2,$3)', [eid, p.personId, p.paid]);
      for (const pid of participants)
        await client.query('INSERT INTO expense_participants (expense_id, person_id) VALUES ($1,$2)', [eid, pid]);
      await client.query('COMMIT');
      return eid;
    } catch (e) {
      await client.query('ROLLBACK'); throw e;
    } finally {
      client.release();
    }
  },
  async deleteExpense(id) {
    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);
  },
};
