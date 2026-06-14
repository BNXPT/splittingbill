// Adapter: SQLite (sql.js / WASM) — ใช้ตอนรันในเครื่อง เก็บเป็นไฟล์ local
// ไม่ต้องคอมไพล์ native, ไม่ต้องติดตั้งฐานข้อมูลอะไรเพิ่ม
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_FILE = process.env.DB_FILE || path.join(__dirname, '..', 'billsplit.sqlite');

let db;
const persist = () => fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
const all = (sql, p = []) => { const s = db.prepare(sql); s.bind(p); const r = []; while (s.step()) r.push(s.getAsObject()); s.free(); return r; };
const run = (sql, p = []) => { const s = db.prepare(sql); s.bind(p); s.step(); s.free(); };
const lastId = () => db.exec('SELECT last_insert_rowid() AS id')[0].values[0][0];

module.exports = {
  async init() {
    const SQL = await initSqlJs();
    db = new SQL.Database(fs.existsSync(DB_FILE) ? fs.readFileSync(DB_FILE) : null);
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(`
      CREATE TABLE IF NOT EXISTS people (
        id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL );
      CREATE TABLE IF NOT EXISTS expenses (
        id INTEGER PRIMARY KEY AUTOINCREMENT, description TEXT NOT NULL,
        amount REAL NOT NULL, created_at TEXT DEFAULT (datetime('now','localtime')) );
      CREATE TABLE IF NOT EXISTS expense_payers (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE, paid REAL NOT NULL );
      CREATE TABLE IF NOT EXISTS expense_participants (
        expense_id INTEGER NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
        person_id INTEGER NOT NULL REFERENCES people(id) ON DELETE CASCADE );
    `);
    persist();
  },

  async listPeople() {
    return all('SELECT id, name FROM people ORDER BY id');
  },
  async addPerson(name) {
    run('INSERT INTO people (name) VALUES (?)', [name]);
    const id = lastId(); persist();
    return { id, name };
  },
  async deletePerson(id) {
    run('DELETE FROM people WHERE id = ?', [id]); persist();
  },

  async listExpenses() {
    const expenses = all('SELECT * FROM expenses ORDER BY id DESC');
    return expenses.map((e) => ({
      ...e,
      payers: all(`SELECT ep.person_id, ep.paid, pe.name FROM expense_payers ep
                   JOIN people pe ON pe.id = ep.person_id WHERE ep.expense_id = ?`, [e.id]),
      participants: all(`SELECT epa.person_id, pe.name FROM expense_participants epa
                         JOIN people pe ON pe.id = epa.person_id WHERE epa.expense_id = ?`, [e.id]),
    }));
  },
  async addExpense({ description, amount, payers, participants }) {
    db.exec('BEGIN');
    try {
      run('INSERT INTO expenses (description, amount) VALUES (?, ?)', [description, amount]);
      const eid = lastId();
      for (const p of payers) run('INSERT INTO expense_payers (expense_id, person_id, paid) VALUES (?,?,?)', [eid, p.personId, p.paid]);
      for (const pid of participants) run('INSERT INTO expense_participants (expense_id, person_id) VALUES (?,?)', [eid, pid]);
      db.exec('COMMIT'); persist();
      return eid;
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  },
  async deleteExpense(id) {
    run('DELETE FROM expenses WHERE id = ?', [id]); persist();
  },
};
