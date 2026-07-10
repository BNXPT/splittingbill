import { useState } from 'react';
import { api } from './api';

// หน้าเข้าสู่ระบบ / สมัครสมาชิก ด้วย username + password
export default function Auth({ onAuthed }) {
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isRegister = mode === 'register';

  const submit = async () => {
    setError('');
    const u = username.trim();
    if (!u || !password) return setError('กรุณากรอกชื่อผู้ใช้และรหัสผ่าน');
    if (isRegister) {
      if (u.length < 3) return setError('ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร');
      if (password.length < 4) return setError('รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร');
      if (password !== confirm) return setError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');
    }
    setLoading(true);
    try {
      const user = isRegister
        ? await api.register(u, password)
        : await api.login(u, password);
      onAuthed(user);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setMode(isRegister ? 'login' : 'register');
    setError(''); setPassword(''); setConfirm('');
  };

  return (
    <div className="auth-wrap">
      <section className="card auth-card">
        <h2>{isRegister ? '📝 สมัครสมาชิก' : '🔐 เข้าสู่ระบบ'}</h2>
        <p className="muted auth-sub">
          {isRegister ? 'สร้างบัญชีเพื่อเก็บบิลของคุณไว้บนเซิร์ฟเวอร์' : 'เข้าสู่ระบบเพื่อดูบิลของคุณ'}
        </p>

        <label>ชื่อผู้ใช้ (username)</label>
        <input
          value={username}
          placeholder="เช่น bank123"
          autoComplete="username"
          onChange={(e) => setUsername(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        <label>รหัสผ่าน (password)</label>
        <input
          type="password"
          value={password}
          placeholder="รหัสผ่าน"
          autoComplete={isRegister ? 'new-password' : 'current-password'}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />

        {isRegister && (
          <>
            <label>ยืนยันรหัสผ่าน</label>
            <input
              type="password"
              value={confirm}
              placeholder="พิมพ์รหัสผ่านอีกครั้ง"
              autoComplete="new-password"
              onChange={(e) => setConfirm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </>
        )}

        {error && <p className="error">{error}</p>}

        <button className="primary wide" onClick={submit} disabled={loading}>
          {loading ? 'กำลังดำเนินการ…' : isRegister ? 'สมัครสมาชิก' : 'เข้าสู่ระบบ'}
        </button>

        <p className="auth-switch">
          {isRegister ? 'มีบัญชีอยู่แล้ว?' : 'ยังไม่มีบัญชี?'}{' '}
          <button type="button" className="link" onClick={switchMode}>
            {isRegister ? 'เข้าสู่ระบบ' : 'สมัครสมาชิก'}
          </button>
        </p>
      </section>
    </div>
  );
}
