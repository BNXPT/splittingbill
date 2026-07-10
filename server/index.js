require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const db = require('./db');
const repo = require('./repo');
const auth = require('./auth');
const { summarize } = require('./split');

const app = express();

// CORS: ตั้ง CORS_ORIGIN เป็นลิงก์ frontend ได้, ไม่ตั้ง = อนุญาตทุกที่
const origin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
app.use(cors({ origin }));
app.use(express.json());

// ตัวช่วยให้ error ใน async route ไม่ทำให้เซิร์ฟเวอร์ล่ม + ส่ง status ตาม httpError
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
});

app.get('/api/health', (req, res) => res.json({ ok: true, db: 'postgres' }));

// ================= Auth (username + password) =================
app.post('/api/auth/register', wrap(async (req, res) => {
  const { username, password } = req.body;
  res.json(await auth.register(username, password));
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body;
  res.json(await auth.login(username, password));
}));

// ดูข้อมูลผู้ใช้ปัจจุบันจาก token (ใช้ตอนเปิดแอปเพื่อเช็คว่ายัง login อยู่ไหม)
app.get('/api/auth/me', auth.requireAuth, (req, res) => res.json({ user: req.user }));

// ตั้งแต่นี้ลงไปต้องล็อกอินก่อนทั้งหมด
app.use('/api/bills', auth.requireAuth);

// ================= บิล =================
app.get('/api/bills', wrap(async (req, res) => {
  res.json(await repo.listBills(req.user.id));
}));

app.post('/api/bills', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อบิล' });
  res.json(await repo.addBill(req.user.id, name));
}));

app.delete('/api/bills/:billId', wrap(async (req, res) => {
  await repo.deleteBill(req.user.id, req.params.billId);
  res.json({ ok: true });
}));

// ================= คนในบิล =================
app.get('/api/bills/:billId/people', wrap(async (req, res) => {
  res.json(await repo.listPeople(req.user.id, req.params.billId));
}));

app.post('/api/bills/:billId/people', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อ' });
  res.json(await repo.addPerson(req.user.id, req.params.billId, name));
}));

app.delete('/api/bills/:billId/people/:id', wrap(async (req, res) => {
  await repo.deletePerson(req.user.id, req.params.billId, req.params.id);
  res.json({ ok: true });
}));

// ================= รายจ่าย (บิลย่อย) =================
app.get('/api/bills/:billId/expenses', wrap(async (req, res) => {
  res.json(await repo.listExpenses(req.user.id, req.params.billId));
}));

app.post('/api/bills/:billId/expenses', wrap(async (req, res) => {
  const { description, amount, payers, participants, allMembers } = req.body;
  if (!description || !amount || amount <= 0)
    return res.status(400).json({ error: 'ใส่รายละเอียดและจำนวนเงินให้ถูกต้อง' });
  if (!Array.isArray(payers) || payers.length === 0)
    return res.status(400).json({ error: 'ต้องมีคนออกเงินอย่างน้อย 1 คน' });
  if (!allMembers && (!Array.isArray(participants) || participants.length === 0))
    return res.status(400).json({ error: 'ต้องมีคนร่วมหารอย่างน้อย 1 คน' });

  const totalPaid = payers.reduce((s, p) => s + Number(p.paid), 0);
  if (Math.round(totalPaid * 100) !== Math.round(Number(amount) * 100))
    return res.status(400).json({ error: 'ยอดที่แต่ละคนออก รวมกันต้องเท่ากับยอดรวมรายการ' });

  await repo.addExpense(req.user.id, req.params.billId, {
    description: description.trim(), amount: Number(amount), payers,
    participants: participants || [], allMembers: !!allMembers,
  });
  const list = await repo.listExpenses(req.user.id, req.params.billId);
  res.json(list[0]); // รายการล่าสุดอยู่บนสุด
}));

app.delete('/api/bills/:billId/expenses/:id', wrap(async (req, res) => {
  await repo.deleteExpense(req.user.id, req.params.billId, req.params.id);
  res.json({ ok: true });
}));

// ================= สรุปผล: ใครต้องจ่ายให้ใคร =================
app.get('/api/bills/:billId/summary', wrap(async (req, res) => {
  const people = await repo.listPeople(req.user.id, req.params.billId);
  const rawExpenses = await repo.listExpenses(req.user.id, req.params.billId);
  const allIds = people.map((p) => p.id);
  const expenses = rawExpenses.map((e) => ({
    amount: e.amount,
    payers: e.payers.map((p) => ({ personId: p.person_id, paid: p.paid })),
    // allMembers = หารทุกคนในบิลตอนนี้ (รวมคนที่เพิ่มทีหลัง)
    participants: e.allMembers ? allIds : e.participants.map((p) => p.person_id),
  }));
  const result = summarize(people, expenses);
  const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
  res.json({
    totalSpent: result.totalSpent,
    balances: Object.entries(result.balances).map(([id, net]) => ({
      personId: Number(id), name: nameOf[id], net,
    })),
    transactions: result.transactions.map((t) => ({
      from: nameOf[t.from], to: nameOf[t.to], amount: t.amount,
    })),
  });
}));

// ================= เสิร์ฟหน้าเว็บ (frontend) จาก service เดียวกัน =================
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
db.init()
  .then(() => app.listen(PORT, () => console.log(`API (postgres) ทำงานที่ port ${PORT}`)))
  .catch((err) => { console.error('เปิดฐานข้อมูลไม่สำเร็จ:', err); process.exit(1); });
