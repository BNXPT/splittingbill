// การคำนวณหารเงิน — ใช้หน่วย "สตางค์" (จำนวนเต็ม) เพื่อความแม่นยำ ไม่มี error จากทศนิยม
// (เวอร์ชัน frontend — ทำงานในเบราว์เซอร์ ไม่ต้องมี server)

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

export function settle(net) {
  const debtors = [];
  const creditors = [];
  for (const [id, v] of Object.entries(net)) {
    if (v < 0) debtors.push({ id, amount: -v });
    else if (v > 0) creditors.push({ id, amount: v });
  }
  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);
  const transactions = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amount, creditors[j].amount);
    if (pay > 0) transactions.push({ from: debtors[i].id, to: creditors[j].id, amount: toBaht(pay) });
    debtors[i].amount -= pay;
    creditors[j].amount -= pay;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return transactions;
}

export function summarize(people, expenses) {
  const net = computeBalances(people, expenses);
  const balances = Object.fromEntries(Object.entries(net).map(([id, s]) => [id, toBaht(s)]));
  const total = expenses.reduce((sum, e) => sum + toSatang(e.amount), 0);
  return { totalSpent: toBaht(total), balances, transactions: settle(net) };
}
