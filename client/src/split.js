// การคำนวณหารเงิน — ใช้หน่วย "สตางค์" (จำนวนเต็ม) เพื่อความแม่นยำ
export const toSatang = (baht) => Math.round(Number(baht) * 100);
export const toBaht = (satang) => satang / 100;

export function splitEqual(amountSatang, participantIds) {
  const n = participantIds.length;
  const shares = {};
  if (n === 0) return shares;
  const base = Math.floor(amountSatang / n);
  const remainder = amountSatang - base * n;
  for (let i = 0; i < n; i++) shares[participantIds[i]] = base + (i < remainder ? 1 : 0);
  return shares;
}

// แบ่งจำนวนเต็ม total ลงในถังตามสัดส่วน weights แบบเป๊ะ (ผลรวม = total เสมอ)
function allocate(total, weights) {
  const W = weights.reduce((a, b) => a + b, 0);
  if (W === 0) return weights.map(() => 0);
  const raw = weights.map((w) => (total * w) / W);
  const out = raw.map(Math.floor);
  const rem = total - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0]);
  for (let i = 0; i < rem; i++) out[order[i][1]]++;
  return out;
}

export function computeBalances(people, expenses) {
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

// คืนเงินให้ทุกคนที่ออกไปก่อน ตามแต่ละรายการ แล้วหักลบรายคู่
export function settle(people, expenses) {
  const owe = {};
  const add = (from, to, sat) => {
    if (from === to || sat === 0) return;
    const k = from + '|' + to;
    owe[k] = (owe[k] || 0) + sat;
  };
  for (const e of expenses) {
    const shares = splitEqual(toSatang(e.amount), e.participants);
    const payerWeights = e.payers.map((p) => toSatang(p.paid));
    for (const pid of e.participants) {
      const parts = allocate(shares[pid], payerWeights);
      e.payers.forEach((payer, idx) => add(pid, payer.personId, parts[idx]));
    }
  }
  const seen = new Set();
  const tx = [];
  for (const key of Object.keys(owe)) {
    const [a, b] = key.split('|');
    const back = b + '|' + a;
    if (seen.has(back)) continue;
    seen.add(key);
    const net = (owe[key] || 0) - (owe[back] || 0);
    if (net > 0) tx.push({ from: a, to: b, amount: toBaht(net) });
    else if (net < 0) tx.push({ from: b, to: a, amount: toBaht(-net) });
  }
  tx.sort((x, y) => y.amount - x.amount);
  return tx;
}

export function summarize(people, expenses) {
  const net = computeBalances(people, expenses);
  const balances = Object.fromEntries(Object.entries(net).map(([id, s]) => [id, toBaht(s)]));
  const total = expenses.reduce((sum, e) => sum + toSatang(e.amount), 0);
  return { totalSpent: toBaht(total), balances, transactions: settle(people, expenses) };
}