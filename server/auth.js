// ระบบล็อกอิน/สมัครสมาชิก ด้วย username + password
//  - เก็บรหัสผ่านแบบ hash (bcrypt) ไม่เก็บรหัสจริง
//  - ออก token (JWT) ให้ client ถือไว้เพื่อยืนยันตัวตนในการเรียก API
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('./db');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL = '7d'; // token อยู่ได้ 7 วัน

const signToken = (user) =>
  jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });

const publicUser = (u) => ({ id: u.id, username: u.username });

// สมัครสมาชิก: ตรวจ username ซ้ำ, hash รหัสผ่าน, แล้วบันทึก
async function register(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  if (username.length < 3) throw httpError(400, 'ชื่อผู้ใช้ต้องยาวอย่างน้อย 3 ตัวอักษร');
  if (password.length < 4) throw httpError(400, 'รหัสผ่านต้องยาวอย่างน้อย 4 ตัวอักษร');

  const password_hash = await bcrypt.hash(password, 10);
  try {
    const { rows } = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [username, password_hash]
    );
    const user = rows[0];
    return { token: signToken(user), user: publicUser(user) };
  } catch (e) {
    if (e.code === '23505') throw httpError(409, 'มีชื่อผู้ใช้นี้อยู่แล้ว'); // unique_violation
    throw e;
  }
}

// เข้าสู่ระบบ: หาผู้ใช้จาก username แล้วเทียบรหัสผ่าน
async function login(username, password) {
  username = String(username || '').trim();
  password = String(password || '');
  const { rows } = await pool.query(
    'SELECT id, username, password_hash FROM users WHERE username = $1',
    [username]
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash)))
    throw httpError(401, 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
  return { token: signToken(user), user: publicUser(user) };
}

// middleware: ตรวจ token จาก header Authorization: Bearer <token>
// ผ่านแล้วจะเซ็ต req.user = { id, username }
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบ' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.uid, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่' });
  }
}

// error ที่พก status code มาด้วย เพื่อให้ route ตอบกลับได้ถูก
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

module.exports = { register, login, requireAuth, httpError };
