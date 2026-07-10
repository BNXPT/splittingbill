// การอ่าน/เขียนข้อมูลบิล-คน-รายจ่าย ทุกอย่างผูกกับผู้ใช้ (user_id) เสมอ
// ผู้ใช้เห็นเฉพาะบิลของตัวเองเท่านั้น
const { pool, num } = require('./db');
const { httpError } = require('./auth');

// ตรวจว่าบิลนี้เป็นของผู้ใช้จริง ไม่งั้นโยน 404 (กันการแอบดูบิลคนอื่น)
async function assertBillOwner(userId, billId) {
  const { rows } = await pool.query(
    'SELECT id, name, created_at FROM bills WHERE id = $1 AND user_id = $2',
    [billId, userId]
  );
  if (!rows[0]) throw httpError(404, 'ไม่พบบิลนี้');
  return rows[0];
}

// ---------- บิล ----------
async function listBills(userId) {
  const { rows } = await pool.query(
    'SELECT id, name, created_at FROM bills WHERE user_id = $1 ORDER BY id DESC',
    [userId]
  );
  return rows;
}

async function addBill(userId, name) {
  const { rows } = await pool.query(
    'INSERT INTO bills (user_id, name) VALUES ($1, $2) RETURNING id, name, created_at',
    [userId, name]
  );
  return rows[0];
}

async function deleteBill(userId, billId) {
  await assertBillOwner(userId, billId);
  await pool.query('DELETE FROM bills WHERE id = $1', [billId]); // ON DELETE CASCADE ลบคน/รายจ่ายให้เอง
}

// ---------- คนในบิล ----------
async function listPeople(userId, billId) {
  await assertBillOwner(userId, billId);
  const { rows } = await pool.query(
    'SELECT id, name FROM people WHERE bill_id = $1 ORDER BY id',
    [billId]
  );
  return rows;
}

async function addPerson(userId, billId, name) {
  await assertBillOwner(userId, billId);
  const { rows } = await pool.query(
    'INSERT INTO people (bill_id, name) VALUES ($1, $2) RETURNING id, name',
    [billId, name]
  );
  return rows[0];
}

// ลบคน แล้วเก็บกวาดรายจ่ายที่ไม่สมบูรณ์ทิ้ง
// (รายจ่ายที่ไม่มีคนออกเงินเหลือ หรือหารเฉพาะบางคนแล้วไม่เหลือคนหาร)
async function deletePerson(userId, billId, personId) {
  await assertBillOwner(userId, billId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM people WHERE id = $1 AND bill_id = $2', [personId, billId]);
    await client.query(
      `DELETE FROM expenses e
       WHERE e.bill_id = $1
         AND (
           NOT EXISTS (SELECT 1 FROM expense_payers ep WHERE ep.expense_id = e.id)
           OR (e.all_members = false
               AND NOT EXISTS (SELECT 1 FROM expense_participants epa WHERE epa.expense_id = e.id))
         )`,
      [billId]
    );
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

// ---------- รายจ่าย (บิลย่อย) ----------
async function listExpenses(userId, billId) {
  await assertBillOwner(userId, billId);
  const { rows: expenses } = await pool.query(
    'SELECT id, description, amount, all_members, created_at FROM expenses WHERE bill_id = $1 ORDER BY id DESC',
    [billId]
  );
  const out = [];
  for (const e of expenses) {
    const { rows: payers } = await pool.query(
      `SELECT ep.person_id, ep.paid, pe.name FROM expense_payers ep
       JOIN people pe ON pe.id = ep.person_id WHERE ep.expense_id = $1`,
      [e.id]
    );
    const { rows: participants } = await pool.query(
      `SELECT epa.person_id, pe.name FROM expense_participants epa
       JOIN people pe ON pe.id = epa.person_id WHERE epa.expense_id = $1`,
      [e.id]
    );
    out.push({
      id: e.id,
      description: e.description,
      amount: num(e.amount),
      allMembers: e.all_members,
      created_at: e.created_at,
      payers: payers.map((p) => ({ person_id: p.person_id, paid: num(p.paid), name: p.name })),
      participants, // [{ person_id, name }]
    });
  }
  return out;
}

async function addExpense(userId, billId, { description, amount, payers, participants, allMembers }) {
  await assertBillOwner(userId, billId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'INSERT INTO expenses (bill_id, description, amount, all_members) VALUES ($1, $2, $3, $4) RETURNING id',
      [billId, description, amount, !!allMembers]
    );
    const eid = rows[0].id;
    for (const p of payers)
      await client.query(
        'INSERT INTO expense_payers (expense_id, person_id, paid) VALUES ($1, $2, $3)',
        [eid, p.personId, p.paid]
      );
    // allMembers = หารทุกคนในบิล (คนที่เพิ่มทีหลังก็หารด้วย) จึงไม่บันทึกรายชื่อผู้หาร
    if (!allMembers)
      for (const pid of participants)
        await client.query(
          'INSERT INTO expense_participants (expense_id, person_id) VALUES ($1, $2)',
          [eid, pid]
        );
    await client.query('COMMIT');
    return eid;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function deleteExpense(userId, billId, expenseId) {
  await assertBillOwner(userId, billId);
  await pool.query('DELETE FROM expenses WHERE id = $1 AND bill_id = $2', [expenseId, billId]);
}

module.exports = {
  assertBillOwner,
  listBills, addBill, deleteBill,
  listPeople, addPerson, deletePerson,
  listExpenses, addExpense, deleteExpense,
};
