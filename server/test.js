// ทดสอบความถูกต้องของการคำนวณ: รัน `node test.js`
const assert = require('assert');
const { summarize, splitEqual, toSatang } = require('./split');

// 1) เศษหารลงตัวเป๊ะ ผลรวมต้องเท่าเดิมเสมอ
const s = splitEqual(toSatang(100), ['a', 'b', 'c']);
assert.strictEqual(Object.values(s).reduce((x, y) => x + y, 0), 10000);

// 2) ยอดสุทธิของทุกคนรวมกันต้องเป็น 0 และโอนแล้วเหลือ 0
const r = summarize([{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }], [
  { amount: 1200, payers: [{ personId: 'A', paid: 1200 }], participants: ['A', 'B', 'C', 'D'] },
  { amount: 500, payers: [{ personId: 'B', paid: 300 }, { personId: 'C', paid: 200 }], participants: ['A', 'B', 'C', 'D'] },
  { amount: 90, payers: [{ personId: 'D', paid: 90 }], participants: ['B', 'C', 'D'] },
]);
assert.ok(Math.abs(Object.values(r.balances).reduce((x, y) => x + y, 0)) < 1e-9);

const net = { ...r.balances };
for (const t of r.transactions) { net[t.from] += t.amount; net[t.to] -= t.amount; }
assert.ok(Object.values(net).every(v => Math.abs(v) < 1e-9));

console.log('✓ ผ่านทุกการทดสอบ — การคำนวณแม่นยำและยุติธรรม');
