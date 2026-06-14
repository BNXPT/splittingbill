// การคำนวณหารเงิน — ใช้หน่วย "สตางค์" (จำนวนเต็ม) เพื่อความแม่นยำ ไม่มี error จากทศนิยม
// หลักการ: หารเท่ากันทุกคนที่ร่วมหาร, เศษสตางค์กระจายให้คนแรก ๆ ทีละ 1 สตางค์ (ยุติธรรม + ผลรวมตรงเป๊ะ)

// แปลงบาท -> สตางค์ (ปัดให้เป็นจำนวนเต็ม)
const toSatang = (baht) => Math.round(Number(baht) * 100);
const toBaht = (satang) => satang / 100;

/**
 * หารค่าใช้จ่ายแต่ละรายการแบบเท่ากัน
 * @param {number} amountSatang ยอดรวมรายการ (สตางค์)
 * @param {string[]} participantIds รายชื่อคนที่ร่วมหาร
 * @returns {Object<string, number>} แต่ละคนต้องรับผิดชอบกี่สตางค์
 */
function splitEqual(amountSatang, participantIds) {
  const n = participantIds.length;
  const shares = {};
  if (n === 0) return shares;
  const base = Math.floor(amountSatang / n);
  let remainder = amountSatang - base * n; // เศษ 0..n-1 สตางค์
  for (let i = 0; i < n; i++) {
    shares[participantIds[i]] = base + (i < remainder ? 1 : 0);
  }
  return shares;
}

/**
 * คำนวณยอดสุทธิของทุกคน จากรายการค่าใช้จ่ายทั้งหมด
 * expense = { amount, payers: [{personId, paid}], participants: [personId,...] }
 *   - payers: ใครออกเงินให้ก่อน และออกคนละเท่าไหร่
 *   - participants: ใครร่วมหารบ้าง (หารเท่ากัน)
 * @returns ยอดสุทธิ (สตางค์) ต่อคน: บวก = ควรได้รับคืน, ลบ = ต้องจ่ายเพิ่ม
 */
function computeBalances(people, expenses) {
  const net = {};
  for (const p of people) net[p.id] = 0;

  for (const e of expenses) {
    const amount = toSatang(e.amount);

    // ส่วนที่แต่ละคนต้องรับผิดชอบ (หารเท่ากัน)
    const shares = splitEqual(amount, e.participants);
    for (const pid of e.participants) {
      if (net[pid] === undefined) net[pid] = 0;
      net[pid] -= shares[pid];
    }

    // ส่วนที่แต่ละคนออกเงินไปจริง
    for (const payer of e.payers) {
      if (net[payer.personId] === undefined) net[payer.personId] = 0;
      net[payer.personId] += toSatang(payer.paid);
    }
  }
  return net; // map personId -> สตางค์
}

/**
 * แปลงยอดสุทธิเป็นรายการ "ใครต้องจ่ายให้ใคร" แบบจำนวนครั้งโอนน้อยที่สุด (greedy)
 * @returns [{ from, to, amount(บาท) }]
 */
function settle(net) {
  const debtors = [];   // ติดลบ = ต้องจ่าย
  const creditors = []; // เป็นบวก = ต้องได้รับ
  for (const [id, v] of Object.entries(net)) {
    if (v < 0) debtors.push({ id, amount: -v });
    else if (v > 0) creditors.push({ id, amount: v });
  }
  // เรียงมาก -> น้อย เพื่อจับคู่ยอดใหญ่ก่อน
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) {
      transactions.push({ from: debtors[i].id, to: creditors[j].id, amount: toBaht(pay) });
    }
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transactions;
}

function summarize(people, expenses) {
  const net = computeBalances(people, expenses);
  const balances = Object.fromEntries(
    Object.entries(net).map(([id, s]) => [id, toBaht(s)])
  );
  const total = expenses.reduce((sum, e) => sum + toSatang(e.amount), 0);
  return {
    totalSpent: toBaht(total),
    balances,                 // personId -> ยอดสุทธิ (บาท)
    transactions: settle(net) // ใครจ่ายใครเท่าไหร่
  };
}

module.exports = { toSatang, toBaht, splitEqual, computeBalances, settle, summarize };
