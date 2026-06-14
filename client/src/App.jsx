import { useEffect, useState } from 'react';
import { api } from './api';

const baht = (n) => '฿' + Number(n).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function App() {
  const [people, setPeople] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState(null);

  const reload = async () => {
    const [pe, ex, su] = await Promise.all([api.getPeople(), api.getExpenses(), api.getSummary()]);
    setPeople(pe); setExpenses(ex); setSummary(su);
  };
  useEffect(() => { reload(); }, []);

  return (
    <div className="app">
      <header className="hero">
        <h1>🍻 หารค่าเหล้า / ค่าอาหาร</h1>
        <p>หารเท่ากันทุกคน · คำนวณแม่นยำระดับสตางค์ · เก็บข้อมูลในเครื่องคุณ</p>
      </header>

      <div className="grid">
        <PeoplePanel people={people} onChange={reload} />
        <ExpenseForm people={people} onChange={reload} />
      </div>

      <ExpenseList expenses={expenses} onChange={reload} />
      <Summary summary={summary} />
    </div>
  );
}

/* ---------- คนหาร ---------- */
function PeoplePanel({ people, onChange }) {
  const [name, setName] = useState('');
  const add = async () => {
    if (!name.trim()) return;
    await api.addPerson(name.trim());
    setName('');
    onChange();
  };
  const remove = async (id) => { await api.deletePerson(id); onChange(); };

  return (
    <section className="card">
      <h2>👥 คนที่ร่วมหาร</h2>
      <div className="row">
        <input
          value={name}
          placeholder="ใส่ชื่อคน…"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
        />
        <button className="primary" onClick={add}>+ เพิ่มคน</button>
      </div>
      <ul className="chips">
        {people.length === 0 && <li className="muted">ยังไม่มีใคร เพิ่มชื่อก่อนเลย</li>}
        {people.map((p) => (
          <li key={p.id} className="chip">
            {p.name}
            <button className="x" title="ลบ" onClick={() => remove(p.id)}>×</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- เพิ่มรายการค่าใช้จ่าย ---------- */
function ExpenseForm({ people, onChange }) {
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [payers, setPayers] = useState({});        // { personId: paidAmount(string) }
  const [participants, setParticipants] = useState({}); // { personId: bool }
  const [error, setError] = useState('');

  // default: ทุกคนร่วมหาร
  useEffect(() => {
    setParticipants((prev) => {
      const next = {};
      people.forEach((p) => { next[p.id] = prev[p.id] ?? true; });
      return next;
    });
  }, [people]);

  const togglePayer = (id) => {
    setPayers((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });
  };
  const toggleParticipant = (id) =>
    setParticipants((prev) => ({ ...prev, [id]: !prev[id] }));

  // ช่วยเติมยอดให้คนออกเท่า ๆ กัน
  const autoFillPayers = () => {
    const ids = Object.keys(payers);
    const amt = Math.round(Number(amount) * 100);
    if (!ids.length || !amt) return;
    const base = Math.floor(amt / ids.length);
    let rem = amt - base * ids.length;
    const next = {};
    ids.forEach((id, i) => { next[id] = ((base + (i < rem ? 1 : 0)) / 100).toFixed(2); });
    setPayers(next);
  };

  const partIds = people.filter((p) => participants[p.id]).map((p) => p.id);
  const perHead = partIds.length && amount ? Number(amount) / partIds.length : 0;

  const submit = async () => {
    setError('');
    const amt = Number(amount);
    if (!description.trim()) return setError('ใส่รายละเอียด เช่น “ค่าเหล้า”');
    if (!amt || amt <= 0) return setError('ใส่จำนวนเงินให้ถูกต้อง');
    const payerList = Object.entries(payers).map(([personId, paid]) => ({
      personId: Number(personId), paid: Number(paid),
    }));
    if (!payerList.length) return setError('เลือกคนที่ออกเงินให้ก่อน อย่างน้อย 1 คน');
    if (payerList.some((p) => !p.paid || p.paid < 0)) return setError('ใส่ยอดที่แต่ละคนออกให้ครบ');
    const sumPaid = payerList.reduce((s, p) => s + p.paid, 0);
    if (Math.round(sumPaid * 100) !== Math.round(amt * 100))
      return setError(`ยอดที่ออกรวมกัน (${baht(sumPaid)}) ต้องเท่ากับยอดรวม (${baht(amt)})`);
    if (!partIds.length) return setError('เลือกคนที่ร่วมหารอย่างน้อย 1 คน');

    await api.addExpense({ description: description.trim(), amount: amt, payers: payerList, participants: partIds });
    setDescription(''); setAmount(''); setPayers({});
    onChange();
  };

  return (
    <section className="card">
      <h2>🧾 เพิ่มรายการ</h2>
      {people.length < 1 ? (
        <p className="muted">เพิ่มชื่อคนก่อน แล้วค่อยเพิ่มรายการ</p>
      ) : (
        <>
          <label>รายละเอียด</label>
          <input value={description} placeholder="ค่าเหล้า / ค่าอาหาร…" onChange={(e) => setDescription(e.target.value)} />

          <label>จำนวนเงินรวม (บาท)</label>
          <input type="number" min="0" step="0.01" value={amount} placeholder="0.00" onChange={(e) => setAmount(e.target.value)} />

          <div className="block-head">
            <label>ใครออกเงินให้ก่อน? <span className="muted">({Object.keys(payers).length} คน)</span></label>
            {Object.keys(payers).length > 1 && (
              <button type="button" className="link" onClick={autoFillPayers}>หารยอดออกเท่ากัน</button>
            )}
          </div>
          <div className="people-select">
            {people.map((p) => {
              const on = p.id in payers;
              return (
                <div key={p.id} className={'pay-row' + (on ? ' on' : '')}>
                  <label className="check">
                    <input type="checkbox" checked={on} onChange={() => togglePayer(p.id)} />
                    {p.name}
                  </label>
                  {on && (
                    <input
                      className="amt" type="number" min="0" step="0.01" placeholder="ออกกี่บาท"
                      value={payers[p.id]}
                      onChange={(e) => setPayers((prev) => ({ ...prev, [p.id]: e.target.value }))}
                    />
                  )}
                </div>
              );
            })}
          </div>

          <label>ใครร่วมหารบ้าง? (หารเท่ากัน)</label>
          <div className="chips select">
            {people.map((p) => (
              <button
                key={p.id} type="button"
                className={'chip toggle' + (participants[p.id] ? ' active' : '')}
                onClick={() => toggleParticipant(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>

          {perHead > 0 && (
            <p className="preview">ตกคนละ <b>{baht(perHead)}</b> ({partIds.length} คน)</p>
          )}
          {error && <p className="error">{error}</p>}
          <button className="primary wide" onClick={submit}>บันทึกรายการ</button>
        </>
      )}
    </section>
  );
}

/* ---------- รายการทั้งหมด ---------- */
function ExpenseList({ expenses, onChange }) {
  if (!expenses.length) return null;
  return (
    <section className="card">
      <h2>📋 รายการทั้งหมด ({expenses.length})</h2>
      <ul className="expense-list">
        {expenses.map((e) => (
          <li key={e.id}>
            <div className="exp-main">
              <span className="exp-desc">{e.description}</span>
              <span className="exp-amt">{baht(e.amount)}</span>
            </div>
            <div className="exp-meta">
              ออกโดย: {e.payers.map((p) => `${p.name} (${baht(p.paid)})`).join(', ')}
              {'  ·  '}หาร {e.participants.length} คน: {e.participants.map((p) => p.name).join(', ')}
            </div>
            <button className="x small" onClick={async () => { await api.deleteExpense(e.id); onChange(); }}>ลบ</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------- สรุป ใครจ่ายใคร ---------- */
function Summary({ summary }) {
  if (!summary || (!summary.transactions.length && !summary.balances.length)) return null;
  return (
    <section className="card summary">
      <h2>💰 สรุปผล</h2>
      <p className="total">ยอดใช้จ่ายรวม: <b>{baht(summary.totalSpent)}</b></p>

      <h3>ใครต้องจ่ายให้ใคร</h3>
      {summary.transactions.length === 0 ? (
        <p className="muted">ทุกคนเคลียร์กันหมดแล้ว 🎉</p>
      ) : (
        <ul className="settle">
          {summary.transactions.map((t, i) => (
            <li key={i}>
              <span className="from">{t.from}</span>
              <span className="arrow">→ จ่าย →</span>
              <span className="to">{t.to}</span>
              <span className="pay">{baht(t.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      <h3>ยอดสุทธิแต่ละคน</h3>
      <ul className="balances">
        {summary.balances.map((b) => (
          <li key={b.personId} className={b.net > 0.005 ? 'plus' : b.net < -0.005 ? 'minus' : 'zero'}>
            <span>{b.name}</span>
            <span>{b.net > 0.005 ? 'ควรได้คืน ' : b.net < -0.005 ? 'ต้องจ่ายเพิ่ม ' : 'เท่าทุน '}{baht(Math.abs(b.net))}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
