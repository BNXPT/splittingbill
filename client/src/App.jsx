import { useEffect, useState } from 'react';
import { api } from './api';
import Auth from './Auth';

const baht = (n) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function App() {
  const [user, setUser] = useState(() => api.getUser());
  const [bills, setBills] = useState([]);
  const [currentBill, setCurrentBill] = useState(null);
  const loadBills = async () => setBills(await api.getBills());

  // ออกจากระบบ (เคลียร์ทุกอย่างกลับหน้า login)
  const signOut = () => { api.logout(); setUser(null); setCurrentBill(null); setBills([]); };

  // token หมดอายุระหว่างใช้งาน -> เด้งกลับหน้า login อัตโนมัติ
  useEffect(() => {
    const onExpired = () => { setUser(null); setCurrentBill(null); setBills([]); };
    window.addEventListener('auth-expired', onExpired);
    return () => window.removeEventListener('auth-expired', onExpired);
  }, []);

  // โหลดบิลใหม่ทุกครั้งที่ล็อกอินสำเร็จ
  useEffect(() => { if (user) loadBills(); }, [user]);

  if (!user) {
    return (
      <div className="app">
        <header className="hero">
          <h1>🍻 หารค่าเหล้า / ค่าอาหาร</h1>
          <p>หารเท่ากันทุกคน · คำนวณแม่นยำระดับสตางค์</p>
        </header>
        <Auth onAuthed={setUser} />
      </div>
    );
  }

  return (
    <div className="app">
      <header className="hero">
        <div className="hero-bar">
          <span className="user-badge">👤 {user.username}</span>
          <button className="logout" onClick={signOut}>ออกจากระบบ</button>
        </div>
        <h1>🍻 หารค่าเหล้า / ค่าอาหาร</h1>
        <p>หารเท่ากันทุกคน · คำนวณแม่นยำระดับสตางค์</p>
      </header>
      {currentBill ? (
        <BillDetail bill={currentBill} onBack={() => { setCurrentBill(null); loadBills(); }} />
      ) : (
        <BillList bills={bills} onOpen={setCurrentBill} onChange={loadBills} />
      )}
    </div>
  );
}

function BillList({ bills, onOpen, onChange }) {
  const [name, setName] = useState('');
  const [pendingDelete, setPendingDelete] = useState(null);
  const [toast, setToast] = useState('');
  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(''), 2200); };

  const add = async () => {
    if (!name.trim()) return;
    const bill = await api.addBill(name.trim());
    setName(''); await onChange(); onOpen(bill);
  };
  const askDelete = (e, id) => { e.stopPropagation(); setPendingDelete(id); };
  const confirmDelete = async () => {
    await api.deleteBill(pendingDelete);
    setPendingDelete(null);
    showToast('🗑️ ลบบิลแล้ว');
    onChange();
  };

  return (
    <section className="card">
      <h2>🧾 บิลทั้งหมด</h2>
      <div className="row">
        <input value={name} placeholder="ชื่อบิล เช่น ปาร์ตี้วันเสาร์, ทริปเชียงใหม่…"
          onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <button className="primary" onClick={add}>+ เพิ่มบิล</button>
      </div>
      <ul className="bill-list">
        {bills.length === 0 && <li className="muted">ยังไม่มีบิล กดเพิ่มบิลเพื่อเริ่มเลย</li>}
        {bills.map((b) => (
          <li key={b.id} className="bill-item" onClick={() => onOpen(b)}>
            <div>
              <div className="bill-name">{b.name}</div>
              <div className="bill-date">{b.created_at}</div>
            </div>
            <div className="bill-actions">
              <span className="open">เปิด →</span>
              <button className="x small" onClick={(e) => askDelete(e, b.id)}>ลบ</button>
            </div>
          </li>
        ))}
      </ul>

      {pendingDelete !== null && (
        <ConfirmModal message="ลบบิลนี้และข้อมูลทั้งหมดในบิล?" onConfirm={confirmDelete} onCancel={() => setPendingDelete(null)} />
      )}
      <Toast message={toast} />
    </section>
  );
}

function ConfirmModal({ message, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-icon">?</div>
        <p className="modal-msg">{message}</p>
        <div className="modal-actions">
          <button className="btn-cancel" onClick={onCancel}>ยกเลิก</button>
          <button className="btn-confirm" onClick={onConfirm}>ตกลง</button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return <div className="toast">{message}</div>;
}

function BillDetail({ bill, onBack }) {
  const [people, setPeople] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const reload = async () => {
    const [pe, ex, su] = await Promise.all([
      api.getPeople(bill.id), api.getExpenses(bill.id), api.getSummary(bill.id),
    ]);
    setPeople(pe); setExpenses(ex); setSummary(su);
  };
  useEffect(() => { reload(); }, [bill.id]);

  return (
    <>
      <div className="bill-head">
        <button className="back" onClick={onBack}>← บิลทั้งหมด</button>
        <h2 className="current-bill">{bill.name}</h2>
      </div>

      <PeoplePanel billId={bill.id} people={people} onChange={reload} />

      <button className="primary wide add-sub-btn" onClick={() => setShowForm(true)} disabled={people.length < 1}>
        ➕ เพิ่มบิลย่อย
      </button>
      {people.length < 1 && <p className="muted hint">เพิ่มชื่อคนก่อน แล้วค่อยเพิ่มบิลย่อย</p>}

      <ExpenseList billId={bill.id} expenses={expenses} onChange={reload} />
      <Summary summary={summary} />

      {showForm && (
        <ExpenseForm billId={bill.id} people={people} onChange={reload} onClose={() => setShowForm(false)} />
      )}
    </>
  );
}

function PeoplePanel({ billId, people, onChange }) {
  const [name, setName] = useState('');
  const [item, setItem] = useState('');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const add = async () => {
    setError('');
    if (!name.trim()) return setError('ใส่ชื่อคนก่อน');
    const amt = Number(amount);
    if ((item.trim() && !(amt > 0)) || (!item.trim() && amt > 0))
      return setError('ถ้าจะใส่รายการ ต้องใส่ทั้งชื่อรายการและจำนวนเงิน');

    const person = await api.addPerson(billId, name.trim());
    if (item.trim() && amt > 0) {
      await api.addExpense(billId, {
        description: item.trim(), amount: amt,
        payers: [{ personId: person.id, paid: amt }], allMembers: true,
      });
    }
    setName(''); setItem(''); setAmount('');
    onChange();
  };
  const remove = async (id) => { await api.deletePerson(billId, id); onChange(); };

  return (
    <section className="card">
      <h2>👥 คนที่ร่วมหาร</h2>
      <input value={name} placeholder="ชื่อคน…" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      <div className="row2">
        <input value={item} placeholder="รายการที่ออกก่อน (ไม่ใส่ก็ได้)" onChange={(e) => setItem(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
        <input className="amt" type="number" min="0" step="0.01" value={amount} placeholder="จำนวนเงิน" onChange={(e) => setAmount(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
      </div>
      {error && <p className="error">{error}</p>}
      <button className="primary wide" onClick={add}>+ เพิ่ม</button>
      <ul className="chips">
        {people.length === 0 && <li className="muted">ยังไม่มีใคร เพิ่มชื่อก่อนเลย</li>}
        {people.map((p) => (
          <li key={p.id} className="chip">{p.name}<button className="x" title="ลบ" onClick={() => remove(p.id)}>×</button></li>
        ))}
      </ul>
    </section>
  );
}

function ExpenseForm({ billId, people, onChange, onClose }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payers, setPayers] = useState({});
  const [participants, setParticipants] = useState({});
  const [error, setError] = useState('');

  useEffect(() => {
    setParticipants((prev) => { const next = {}; people.forEach((p) => { next[p.id] = prev[p.id] ?? true; }); return next; });
  }, [people]);

  const togglePayer = (id) => setPayers((prev) => { const next = { ...prev }; if (id in next) delete next[id]; else next[id] = ''; return next; });
  const toggleParticipant = (id) => setParticipants((prev) => ({ ...prev, [id]: !prev[id] }));
  const autoFillPayers = () => {
    const ids = Object.keys(payers); const amt = Math.round(Number(amount) * 100);
    if (!ids.length || !amt) return;
    const base = Math.floor(amt / ids.length); const rem = amt - base * ids.length; const next = {};
    ids.forEach((id, i) => { next[id] = ((base + (i < rem ? 1 : 0)) / 100).toFixed(2); });
    setPayers(next);
  };
  const partIds = people.filter((p) => participants[p.id]).map((p) => p.id);
  const perHead = partIds.length && amount ? Number(amount) / partIds.length : 0;

  const submit = async () => {
    setError(''); const amt = Number(amount);
    if (!description.trim()) return setError('ใส่รายละเอียด เช่น “ค่าเหล้า”');
    if (!amt || amt <= 0) return setError('ใส่จำนวนเงินให้ถูกต้อง');
    const payerList = Object.entries(payers).map(([personId, paid]) => ({ personId: Number(personId), paid: Number(paid) }));
    if (!payerList.length) return setError('เลือกคนที่ออกเงินให้ก่อน อย่างน้อย 1 คน');
    if (payerList.some((p) => !p.paid || p.paid < 0)) return setError('ใส่ยอดที่แต่ละคนออกให้ครบ');
    const sumPaid = payerList.reduce((s, p) => s + p.paid, 0);
    if (Math.round(sumPaid * 100) !== Math.round(amt * 100)) return setError(`ยอดที่ออกรวมกัน (${baht(sumPaid)}) ต้องเท่ากับยอดรวม (${baht(amt)})`);
    if (!partIds.length) return setError('เลือกคนที่ร่วมหารอย่างน้อย 1 คน');
    await api.addExpense(billId, { description: description.trim(), amount: amt, payers: payerList, participants: partIds });
    setDescription(''); setAmount(''); setPayers({});
    onChange();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card form-modal" onClick={(e) => e.stopPropagation()}>
        <div className="form-modal-head">
          <h2>🧾 เพิ่มบิลย่อย</h2>
          <button className="close-x" onClick={onClose}>×</button>
        </div>
        <>
          <label>รายละเอียด</label>
          <input value={description} placeholder="ค่าเหล้า / ค่าอาหาร…" onChange={(e) => setDescription(e.target.value)} />

          <label>จำนวนเงินรวม (บาท)</label>
          <input type="number" min="0" step="0.01" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />

          <div className="block-head">
            <label>ใครออกเงินให้ก่อน? <span className="muted">({Object.keys(payers).length} คน)</span></label>
            {Object.keys(payers).length > 1 && <button type="button" className="link" onClick={autoFillPayers}>หารยอดออกเท่ากัน</button>}
          </div>
          <div className="people-select">
            {people.map((p) => {
              const on = p.id in payers;
              return (
                <div key={p.id} className={'pay-row' + (on ? ' on' : '')}>
                  <label className="check"><input type="checkbox" checked={on} onChange={() => togglePayer(p.id)} />{p.name}</label>
                  {on && <input className="amt" type="number" min="0" step="0.01" placeholder="ออกกี่บาท"
                    value={payers[p.id]} onChange={(e) => setPayers((prev) => ({ ...prev, [p.id]: e.target.value }))} />}
                </div>
              );
            })}
          </div>

          <label>ใครร่วมหารบ้าง? (หารเท่ากัน)</label>
          <div className="chips select">
            {people.map((p) => (
              <button key={p.id} type="button" className={'chip toggle' + (participants[p.id] ? ' active' : '')} onClick={() => toggleParticipant(p.id)}>{p.name}</button>
            ))}
          </div>

          {perHead > 0 && <p className="preview">ตกคนละ <b>{baht(perHead)}</b> ({partIds.length} คน)</p>}
          {error && <p className="error">{error}</p>}
          <button className="primary wide" onClick={submit}>บันทึกบิลย่อย</button>
        </>
      </div>
    </div>
  );
}

function ExpenseList({ billId, expenses, onChange }) {
  if (!expenses.length) return null;
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  return (
    <section className="card">
      <div className="exp-head">
        <h2>📋 บิลย่อยทั้งหมด ({expenses.length})</h2>
        <div className="exp-total">รวมทั้งหมด <b>{baht(total)}</b></div>
      </div>
      <ul className="expense-list">
        {expenses.map((e) => (
          <li key={e.id}>
            <div className="exp-payer">
              {e.payers.map((p) => `${p.name} จ่าย ${baht(p.paid)}`).join(', ')}
            </div>
            <div className="exp-sub">
              {e.description}
              {'  ·  '}
              {e.allMembers
                ? 'หารทุกคนในบิล'
                : `หาร ${e.participants.length} คน: ${e.participants.map((p) => p.name).join(', ')}`}
            </div>
            <button className="x small" onClick={async () => { await api.deleteExpense(billId, e.id); onChange(); }}>ลบ</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

const initial = (name) => (name || '?').trim().charAt(0);

function Summary({ summary }) {
  if (!summary || (!summary.transactions.length && !summary.balances.length)) return null;

  // จัดกลุ่มการโอนตาม "คนที่ต้องจ่าย"
  const byPayer = {};
  for (const t of summary.transactions) (byPayer[t.from] ??= []).push(t);
  const payers = Object.keys(byPayer);

  // เรียงยอดสุทธิ: ได้คืนก่อน แล้วค่อยจ่ายเพิ่ม
  const balances = [...summary.balances].sort((a, b) => b.net - a.net);

  return (
    <section className="card summary">
      <h2>💰 สรุปผล</h2>
      <p className="total">ยอดใช้จ่ายรวม: <b>{baht(summary.totalSpent)}</b></p>

      <h3>ใครต้องจ่ายให้ใคร</h3>
      {payers.length === 0 ? (
        <p className="muted">ทุกคนเคลียร์กันหมดแล้ว 🎉</p>
      ) : (
        <div className="settle-groups">
          {payers.map((name) => {
            const items = byPayer[name];
            const sum = items.reduce((s, t) => s + t.amount, 0);
            return (
              <div className="settle-group" key={name}>
                <div className="sg-head">
                  <span className="avatar red">{initial(name)}</span>
                  <span className="sg-name">{name}</span>
                  <span className="sg-total">จ่ายรวม {baht(sum)}</span>
                </div>
                <ul className="sg-list">
                  {items.map((t, i) => (
                    <li key={i}>
                      <span className="sg-arrow">จ่ายให้</span>
                      <b>{t.to}</b>
                      <span className="sg-amt">{baht(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <h3>ยอดสุทธิแต่ละคน</h3>
      <ul className="balances">
        {balances.map((b) => {
          const cls = b.net > 0.005 ? 'plus' : b.net < -0.005 ? 'minus' : 'zero';
          return (
            <li key={b.personId} className={cls}>
              <span className="bal-name">
                <span className={'avatar ' + (cls === 'plus' ? 'green' : cls === 'minus' ? 'red' : 'gray')}>{initial(b.name)}</span>
                {b.name}
              </span>
              <span className="bal-val">
                {b.net > 0.005 ? 'ควรได้คืน ' : b.net < -0.005 ? 'ต้องจ่ายเพิ่ม ' : 'เท่าทุน '}{baht(Math.abs(b.net))}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}