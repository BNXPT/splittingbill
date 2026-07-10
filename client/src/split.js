// การคำนวณหารเงิน — ใช้หน่วย "สตางค์" (จำนวนเต็ม) เพื่อความแม่นยำ ไม่มี error จากทศนิยม
// หลักการ: หารเท่ากันทุกคนที่ร่วมหาร, เศษสตางค์กระจายให้คนแรก ๆ ทีละ 1 สตางค์ (ยุติธรรม + ผลรวมตรงเป๊ะ)

const toSatang = (baht) => Math.round(Number(baht) * 100);
const toBaht = (satang) => satang / 100;

// หารค่าใช้จ่ายแต่ละรายการแบบเท่ากัน คืน map personId -> สตางค์
export function splitEqual(amountSatang, participantIds) {
  const n = participantIds.length;
  const shares = {};
  if (n === 0) return shares;
  const base = Math.floor(amountSatang / n);
  const remainder = amountSatang - base * n; // เศษ 0..n-1 สตางค์
  for (let i = 0; i < n; i++) {
    shares[participantIds[i]] = base + (i < remainder ? 1 : 0);
  }
  return shares;
}

// คำนวณยอดสุทธิของทุกคน (บวก = ควรได้คืน, ลบ = ต้องจ่ายเพิ่ม)
function computeBalances(people, expenses) {
  const net = {};
  for (const p of people) net[p.id] = 0;

  for (const e of expenses) {
    const amount = toSatang(e.amount);
    const shares = splitEqual(amount, e.participants);
    for (const pid of e.participants) {
      if (net[pid] === undefined) net[pid] = 0;
      net[pid] -= shares[pid];
    }
    for (const payer of e.payers) {
      if (net[payer.personId] === undefined) net[payer.personId] = 0;
      net[payer.personId] += toSatang(payer.paid);
    }
  }
  return net;
}

// จับคู่ "ใครจ่ายใคร" จาก net map (หน่วยสตางค์) แบบ greedy คืน [{from, to, amount(สตางค์)}]
function settleSatang(net) {
  const debtors = [];   // ติดลบ = ต้องจ่าย
  const creditors = []; // เป็นบวก = ต้องได้รับ
  for (const [id, v] of Object.entries(net)) {
    if (v < 0) debtors.push({ id, amount: -v });
    else if (v > 0) creditors.push({ id, amount: v });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const txs = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) txs.push({ from: debtors[i].id, to: creditors[j].id, amount: pay });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return txs;
}

export function summarize(people, expenses) {
  const net = computeBalances(people, expenses);
  const balances = Object.fromEntries(
    Object.entries(net).map(([id, s]) => [id, toBaht(s)])
  );
  const total = expenses.reduce((sum, e) => sum + toSatang(e.amount), 0);

  // "ใครจ่ายใคร" คิดแยกทีละบิลย่อย: ใครไม่ได้ออกของชิ้นนั้น จ่ายคืนคนที่ออกชิ้นนั้น
  // แล้วรวมยอดต่อคู่ (from->to) และหักลบคู่ที่จ่ายไป-มากันเอง ให้เหลือทิศเดียว
  const pair = {}; // "from|to" -> สตางค์
  for (const e of expenses) {
    const amount = toSatang(e.amount);
    const shares = splitEqual(amount, e.participants);
    const eNet = {};
    for (const pid of e.participants) eNet[pid] = (eNet[pid] || 0) - shares[pid];
    for (const p of e.payers) eNet[p.personId] = (eNet[p.personId] || 0) + toSatang(p.paid);
    for (const t of settleSatang(eNet)) {
      const key = `${t.from}|${t.to}`;
      pair[key] = (pair[key] || 0) + t.amount;
    }
  }

  const transactions = [];
  const done = new Set();
  for (const key of Object.keys(pair)) {
    if (done.has(key)) continue;
    const [a, b] = key.split('|');
    const rev = `${b}|${a}`;
    done.add(key); done.add(rev);
    const amt = (pair[key] || 0) - (pair[rev] || 0); // หักลบทิศตรงข้าม
    if (amt > 0) transactions.push({ from: a, to: b, amount: toBaht(amt) });
    else if (amt < 0) transactions.push({ from: b, to: a, amount: toBaht(-amt) });
  }

  return {
    totalSpent: toBaht(total),
    balances,        // personId -> ยอดสุทธิ (บาท)
    transactions,    // ใครจ่ายใครเท่าไหร่ (คิดแยกทีละบิลย่อย)
  };
}
