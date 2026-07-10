// เรียก REST API ของ backend (Express + PostgreSQL) พร้อมแนบ token ทุกครั้ง
// ข้อมูลทั้งหมดเก็บที่ฐานข้อมูลบนเซิร์ฟเวอร์ ไม่ได้อยู่ในเบราว์เซอร์แล้ว
const BASE = import.meta.env.VITE_API_URL || ''; // ว่าง = ใช้ proxy /api ของ vite (dev) หรือ origin เดียวกัน (prod)
const TOKEN_KEY = 'billsplit:token';
const USER_KEY = 'billsplit:user';

const getToken = () => localStorage.getItem(TOKEN_KEY);
const getUser = () => { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } };
const setSession = (token, user) => {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};
const clearSession = () => { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); };

// ตัวช่วยยิง request: แนบ Authorization, แปลง JSON, และโยน error พร้อมข้อความจากเซิร์ฟเวอร์
async function request(path, { method = 'GET', body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}/api${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401) {
    // token หมดอายุ/ไม่ถูกต้อง — เคลียร์เซสชันแล้วบอก App ให้กลับไปหน้า login
    clearSession();
    window.dispatchEvent(new Event('auth-expired'));
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'เกิดข้อผิดพลาด');
  return data;
}

const fmtDate = (iso) => {
  try { return new Date(iso).toLocaleString('th-TH'); } catch { return iso; }
};

export const api = {
  // ----- สถานะการล็อกอิน -----
  getUser,
  isAuthed: () => !!getToken(),
  logout: () => { clearSession(); },

  // ----- Auth -----
  async register(username, password) {
    const { token, user } = await request('/auth/register', { method: 'POST', body: { username, password } });
    setSession(token, user); return user;
  },
  async login(username, password) {
    const { token, user } = await request('/auth/login', { method: 'POST', body: { username, password } });
    setSession(token, user); return user;
  },

  // ----- บิล -----
  async getBills() {
    const bills = await request('/bills');
    return bills.map((b) => ({ ...b, created_at: fmtDate(b.created_at) }));
  },
  async addBill(name) {
    const b = await request('/bills', { method: 'POST', body: { name } });
    return { ...b, created_at: fmtDate(b.created_at) };
  },
  async deleteBill(billId) { return request(`/bills/${billId}`, { method: 'DELETE' }); },

  // ----- คนในบิล -----
  async getPeople(billId) { return request(`/bills/${billId}/people`); },
  async addPerson(billId, name) { return request(`/bills/${billId}/people`, { method: 'POST', body: { name } }); },
  async deletePerson(billId, id) { return request(`/bills/${billId}/people/${id}`, { method: 'DELETE' }); },

  // ----- รายจ่าย (บิลย่อย) -----
  async getExpenses(billId) { return request(`/bills/${billId}/expenses`); },
  async addExpense(billId, payload) { return request(`/bills/${billId}/expenses`, { method: 'POST', body: payload }); },
  async deleteExpense(billId, id) { return request(`/bills/${billId}/expenses/${id}`, { method: 'DELETE' }); },

  // ----- สรุปผล -----
  async getSummary(billId) { return request(`/bills/${billId}/summary`); },
};
