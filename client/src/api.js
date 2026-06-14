// เก็บข้อมูลในเบราว์เซอร์ (localStorage) — ต่างคน/ต่างเครื่อง ข้อมูลแยกกัน ไม่แชร์
// ไม่ต้องมี backend/ฐานข้อมูลกลาง  (เก็บใน "เครื่องของ user" ตามที่ตั้งใจไว้)
import { summarize } from './split.js';

const PKEY = 'billsplit:people';
const EKEY = 'billsplit:expenses';
const SKEY = 'billsplit:seq';

const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));

let seq = load(SKEY, 0);
const nextId = () => { seq += 1; save(SKEY, seq); return seq; };

export const api = {
  async getPeople() {
    return load(PKEY, []);
  },
  async addPerson(name) {
    const people = load(PKEY, []);
    const p = { id: nextId(), name };
    people.push(p);
    save(PKEY, people);
    return p;
  },
  async deletePerson(id) {
    id = Number(id);
    save(PKEY, load(PKEY, []).filter((p) => p.id !== id));
    // เอาคนนี้ออกจากทุกรายการด้วย และทิ้งรายการที่ไม่มีคนออก/คนหารเหลือ
    const expenses = load(EKEY, [])
      .map((e) => ({
        ...e,
        payers: e.payers.filter((x) => x.person_id !== id),
        participants: e.participants.filter((x) => x.person_id !== id),
      }))
      .filter((e) => e.payers.length && e.participants.length);
    save(EKEY, expenses);
    return { ok: true };
  },

  async getExpenses() {
    return load(EKEY, []).slice().reverse(); // รายการล่าสุดอยู่บนสุด
  },
  async addExpense({ description, amount, payers, participants }) {
    const people = load(PKEY, []);
    const nameOf = Object.fromEntries(people.map((p) => [p.id, p.name]));
    const expenses = load(EKEY, []);
    const e = {
      id: nextId(),
      description,
      amount: Number(amount),
      created_at: new Date().toLocaleString('th-TH'),
      payers: payers.map((p) => ({ person_id: Number(p.personId), paid: Number(p.paid), name: nameOf[p.personId] })),
      participants: participants.map((pid) => ({ person_id: Number(pid), name: nameOf[pid] })),
    };
    expenses.push(e);
    save(EKEY, expenses);
    return e;
  },
  async deleteExpense(id) {
    id = Number(id);
    save(EKEY, load(EKEY, []).filter((e) => e.id !== id));
    return { ok: true };
  },

  async getSummary() {
    const people = load(PKEY, []);
    const expenses = load(EKEY, []).map((e) => ({
      amount: e.amount,
      payers: e.payers.map((p) => ({ personId: p.person_id, paid: p.paid })),
      participants: e.participants.map((p) => p.person_id),
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
