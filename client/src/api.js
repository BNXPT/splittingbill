// เก็บข้อมูลในเบราว์เซอร์ (localStorage) — บิลใหญ่หลายบิล แต่ละบิลมีคน+บิลย่อยของตัวเอง
import { summarize } from './split.js';

const KEY = 'billsplit:data';
const blank = () => ({ seq: 0, bills: [], people: {}, expenses: {} });
const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? blank(); } catch { return blank(); } };
const write = (d) => localStorage.setItem(KEY, JSON.stringify(d));
const nextId = (d) => { d.seq += 1; return d.seq; };

export const api = {
  async getBills() { return read().bills.slice().reverse(); },
  async addBill(name) {
    const d = read();
    const bill = { id: nextId(d), name, created_at: new Date().toLocaleString('th-TH') };
    d.bills.push(bill); d.people[bill.id] = []; d.expenses[bill.id] = [];
    write(d); return bill;
  },
  async deleteBill(billId) {
    const d = read(); billId = Number(billId);
    d.bills = d.bills.filter((b) => b.id !== billId);
    delete d.people[billId]; delete d.expenses[billId];
    write(d); return { ok: true };
  },

  async getPeople(billId) { return read().people[billId] ?? []; },
  async addPerson(billId, name) {
    const d = read();
    const p = { id: nextId(d), name };
    (d.people[billId] ??= []).push(p);
    write(d); return p;
  },
  async deletePerson(billId, id) {
    const d = read(); id = Number(id);
    d.people[billId] = (d.people[billId] ?? []).filter((p) => p.id !== id);
    d.expenses[billId] = (d.expenses[billId] ?? [])
      .map((e) => ({ ...e, payers: e.payers.filter((x) => x.person_id !== id), participants: e.participants.filter((x) => x.person_id !== id) }))
      .filter((e) => e.payers.length && (e.allMembers || e.participants.length));
    write(d); return { ok: true };
  },

  async getExpenses(billId) { return (read().expenses[billId] ?? []).slice().reverse(); },
  async addExpense(billId, { description, amount, payers, participants, allMembers }) {
    const d = read();
    const nameOf = Object.fromEntries((d.people[billId] ?? []).map((p) => [p.id, p.name]));
    const e = {
      id: nextId(d), description, amount: Number(amount),
      created_at: new Date().toLocaleString('th-TH'),
      payers: payers.map((p) => ({ person_id: Number(p.personId), paid: Number(p.paid), name: nameOf[p.personId] })),
      allMembers: !!allMembers, // true = หารทุกคนในบิล (คนที่เพิ่มทีหลังก็หารด้วย)
      participants: allMembers ? [] : (participants ?? []).map((pid) => ({ person_id: Number(pid), name: nameOf[pid] })),
    };
    (d.expenses[billId] ??= []).push(e);
    write(d); return e;
  },
  async deleteExpense(billId, id) {
    const d = read(); id = Number(id);
    d.expenses[billId] = (d.expenses[billId] ?? []).filter((e) => e.id !== id);
    write(d); return { ok: true };
  },

  async getSummary(billId) {
    const d = read();
    const people = d.people[billId] ?? [];
    const allIds = people.map((p) => p.id);
    const expenses = (d.expenses[billId] ?? []).map((e) => ({
      amount: e.amount,
      payers: e.payers.map((p) => ({ personId: p.person_id, paid: p.paid })),
      participants: e.allMembers ? allIds : e.participants.map((p) => p.person_id),
    }));
    const result = summarize(people, expenses);
    const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
    return {
      totalSpent: result.totalSpent,
      balances: Object.entries(result.balances).map(([id, net]) => ({ personId: Number(id), name: nameOf[id], net })),
      transactions: result.transactions.map((t) => ({ from: nameOf[t.from], to: nameOf[t.to], amount: t.amount })),
    };
  },
};