const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const repo = require('./db');
const { summarize } = require('./split');

const app = express();

// CORS: ตั้ง CORS_ORIGIN เป็นลิงก์ frontend (เช่นบน Vercel) ได้, ไม่ตั้ง = อนุญาตทุกที่
const origin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*';
app.use(cors({ origin }));
app.use(express.json());

// ตัวช่วยให้ error ใน async route ไม่ทำให้เซิร์ฟเวอร์ล่ม
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(500).json({ error: 'เกิดข้อผิดพลาดที่เซิร์ฟเวอร์' });
});

app.get('/api/health', (req, res) => res.json({ ok: true, db: repo.kind }));

// ---------- คน ----------
app.get('/api/people', wrap(async (req, res) => {
  res.json(await repo.listPeople());
}));

app.post('/api/people', wrap(async (req, res) => {
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'กรุณาใส่ชื่อ' });
  res.json(await repo.addPerson(name));
}));

app.delete('/api/people/:id', wrap(async (req, res) => {
  await repo.deletePerson(req.params.id);
  res.json({ ok: true });
}));

// ---------- รายการค่าใช้จ่าย ----------
app.get('/api/expenses', wrap(async (req, res) => {
  res.json(await repo.listExpenses());
}));

app.post('/api/expenses', wrap(async (req, res) => {
  const { description, amount, payers, participants } = req.body;
  if (!description || !amount || amount <= 0)
    return res.status(400).json({ error: 'ใส่รายละเอียดและจำนวนเงินให้ถูกต้อง' });
  if (!Array.isArray(payers) || payers.length === 0)
    return res.status(400).json({ error: 'ต้องมีคนออกเงินอย่างน้อย 1 คน' });
  if (!Array.isArray(participants) || participants.length === 0)
    return res.status(400).json({ error: 'ต้องมีคนร่วมหารอย่างน้อย 1 คน' });

  const totalPaid = payers.reduce((s, p) => s + Number(p.paid), 0);
  if (Math.round(totalPaid * 100) !== Math.round(Number(amount) * 100))
    return res.status(400).json({ error: 'ยอดที่แต่ละคนออก รวมกันต้องเท่ากับยอดรวมรายการ' });

  await repo.addExpense({ description: description.trim(), amount: Number(amount), payers, participants });
  const list = await repo.listExpenses();
  res.json(list[0]); // รายการล่าสุดอยู่บนสุด
}));

app.delete('/api/expenses/:id', wrap(async (req, res) => {
  await repo.deleteExpense(req.params.id);
  res.json({ ok: true });
}));

// ---------- สรุปผล: ใครต้องจ่ายให้ใคร ----------
app.get('/api/summary', wrap(async (req, res) => {
  const people = await repo.listPeople();
  const rawExpenses = await repo.listExpenses();
  const expenses = rawExpenses.map((e) => ({
    amount: e.amount,
    payers: e.payers.map((p) => ({ personId: p.person_id, paid: p.paid })),
    participants: e.participants.map((p) => p.person_id),
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

// ---------- เสิร์ฟหน้าเว็บ (frontend) จาก service เดียวกัน ----------
// ถ้ามีโฟลเดอร์ client/dist (build แล้ว) ให้เสิร์ฟเป็นหน้าเว็บด้วย
// => deploy ที่เดียวจบ ทั้งเว็บและ API อยู่ลิงก์เดียวกัน ไม่ต้องตั้ง CORS
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  // ทุก path ที่ไม่ใช่ /api ให้ส่งหน้าเว็บ React กลับไป (SPA)
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

const PORT = process.env.PORT || 3001;
repo.init()
  .then(() => app.listen(PORT, () => console.log(`API (${repo.kind}) ทำงานที่ port ${PORT}`)))
  .catch((err) => { console.error('เปิดฐานข้อมูลไม่สำเร็จ:', err); process.exit(1); });
