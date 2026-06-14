// ทดสอบว่า adapter ทั้งสอง (sqlite + postgres) ให้ผลตรงกัน
// รัน: node test-adapters.js   (ใช้ pg-mem จำลอง Postgres จึงไม่ต้องมี server จริง)
const assert = require('assert');
const Module = require('module');

async function scenario(repo) {
  await repo.init();
  const a = await repo.addPerson('แบงค์');
  const b = await repo.addPerson('บอล');
  const c = await repo.addPerson('มิ้น');
  await repo.addExpense({ description: 'ค่าเหล้า', amount: 100, payers: [{ personId: a.id, paid: 100 }], participants: [a.id, b.id, c.id] });
  await repo.addExpense({ description: 'ค่าข้าว', amount: 90, payers: [{ personId: b.id, paid: 45 }, { personId: c.id, paid: 45 }], participants: [a.id, b.id, c.id] });
  const people = await repo.listPeople();
  const expenses = await repo.listExpenses();
  return { people, expenses };
}

(async () => {
  // ----- SQLite (เขียนไฟล์ชั่วคราว) -----
  process.env.DB_FILE = '/tmp/adapter_test.sqlite';
  require('fs').rmSync(process.env.DB_FILE, { force: true });
  const sqlite = require('./db/sqlite');
  const r1 = await scenario(sqlite);

  // ----- Postgres ผ่าน pg-mem (แทน module 'pg') -----
  const memPg = require('pg-mem').newDb().adapters.createPg();
  const origLoad = Module._load;
  Module._load = function (req, ...rest) { return req === 'pg' ? memPg : origLoad.call(this, req, ...rest); };
  process.env.DATABASE_URL = 'postgres://x';
  const pg = require('./db/postgres');
  const r2 = await scenario(pg);
  Module._load = origLoad;

  // ----- เทียบผล -----
  assert.strictEqual(r1.people.length, 3);
  assert.strictEqual(r2.people.length, 3);
  assert.deepStrictEqual(r1.people.map(p => p.name), r2.people.map(p => p.name));
  assert.strictEqual(r1.expenses.length, 2);
  assert.strictEqual(r2.expenses.length, 2);

  // ตรวจ amount เป็นตัวเลข (ไม่ใช่ string) ทั้งสอง adapter
  for (const e of [...r1.expenses, ...r2.expenses]) {
    assert.strictEqual(typeof e.amount, 'number');
    for (const p of e.payers) assert.strictEqual(typeof p.paid, 'number');
  }

  // ตรวจรายการ "ค่าเหล้า" 100 บาท ออกโดยแบงค์ หาร 3 คน เหมือนกัน
  const find = (r) => r.expenses.find(e => e.description === 'ค่าเหล้า');
  const e1 = find(r1), e2 = find(r2);
  assert.strictEqual(e1.amount, 100); assert.strictEqual(e2.amount, 100);
  assert.strictEqual(e1.participants.length, 3); assert.strictEqual(e2.participants.length, 3);
  assert.strictEqual(e1.payers[0].paid, 100); assert.strictEqual(e2.payers[0].paid, 100);

  console.log('✓ adapter ทั้งสอง (sqlite + postgres) ทำงานถูกต้องและให้ผลตรงกัน');
})().catch((e) => { console.error('✗ ทดสอบไม่ผ่าน:', e); process.exit(1); });
