# 🍻 เว็บหารค่าเหล้า / ค่าอาหาร

เว็บแอปหารบิลแบบ **หารเท่ากันทุกคน** คำนวณแม่นยำระดับสตางค์และยุติธรรม
สร้างด้วย **React (Vite) + Node.js (Express) + PostgreSQL** พร้อมระบบ **สมัครสมาชิก/เข้าสู่ระบบ** ด้วย username + password
ฐานข้อมูลรันบน **Docker** (PostgreSQL) และดูข้อมูลผ่าน **PgAdmin4** ธีมสีฟ้า

## ฟีเจอร์
- 🔐 **สมัครสมาชิก / เข้าสู่ระบบ** ด้วย username + password (รหัสผ่านเก็บแบบ hash ด้วย bcrypt, ใช้ token JWT)
- 🧾 แต่ละผู้ใช้มี **บิลของตัวเอง** เห็นเฉพาะบิลตัวเอง
- ➕ เพิ่ม/ลบ ชื่อคนที่ร่วมหารในแต่ละบิล
- 🧾 เพิ่มบิลย่อย พร้อมระบุ **ใครออกเงินให้ก่อน** (หลายคนช่วยกันออกได้) และ **ใครร่วมหารบ้าง** (หรือหารทุกคนในบิล)
- 💰 สรุปอัตโนมัติว่า **ใครต้องจ่ายให้ใครเท่าไหร่** (จับคู่โอนให้น้อยครั้งที่สุด)
- 🗄️ ข้อมูลทั้งหมดเก็บใน **PostgreSQL** (ถาวร ไม่หายเวลารีสตาร์ท)

## วิธีรัน

ต้องมี **Node.js 18+** และ **Docker** ติดตั้งอยู่

```bash
# 1) เปิดฐานข้อมูล PostgreSQL + PgAdmin4 ด้วย Docker
docker compose up -d

# 2) ติดตั้ง dependencies (ทั้ง server และ client)
npm run install:all
npm install            # ติดตั้ง concurrently สำหรับคำสั่ง dev

# 3) รันทั้ง backend + frontend พร้อมกัน
npm run dev
```

จากนั้นเปิด **http://localhost:5173** แล้ว **สมัครสมาชิก** เพื่อเริ่มใช้งาน
(backend API ทำงานที่ http://localhost:3001 และ frontend จะ proxy `/api` ไปให้อัตโนมัติ)

### ดูข้อมูลใน PgAdmin4
เปิด **http://localhost:5050** — มีเซิร์ฟเวอร์ **Bill Splitter (Docker)** เตรียมไว้ให้แล้ว
เวลาเชื่อมต่อครั้งแรกให้ใส่รหัสฐานข้อมูล (ค่า default `billsplit`)

| อะไร | ค่า default |
|------|-------------|
| PgAdmin เข้าใช้ | อีเมล `admin@admin.com` / รหัส `admin` |
| PostgreSQL | user `billsplit` / password `billsplit` / db `billsplit` |
| DATABASE_URL | `postgres://billsplit:billsplit@localhost:5432/billsplit` |

> เปลี่ยนค่าเหล่านี้ได้โดยคัดลอก `.env.example` เป็น `.env` (สำหรับ docker) และ `server/.env.example` เป็น `server/.env` (สำหรับ backend)

### หรือรันแยกกัน 2 เทอร์มินัล
```bash
npm run server   # เทอร์มินัล 1 → backend
npm run client   # เทอร์มินัล 2 → frontend
```

## ทดสอบการคำนวณ
```bash
npm test
```

## โครงสร้าง
```
bill-splitter/
├─ docker-compose.yml   PostgreSQL + PgAdmin4
├─ pgadmin/servers.json  เตรียม connection ให้ PgAdmin อัตโนมัติ
├─ server/              Node.js + Express + PostgreSQL
│  ├─ index.js          REST API + auth routes
│  ├─ db.js             เชื่อม PostgreSQL + สร้างตาราง
│  ├─ auth.js           สมัคร/เข้าสู่ระบบ (bcrypt + JWT) + middleware
│  ├─ repo.js           อ่าน/เขียนข้อมูล (ผูกกับผู้ใช้)
│  ├─ split.js          ตรรกะการหารเงิน (หน่วยสตางค์ แม่นยำ)
│  └─ test.js           ทดสอบความถูกต้องของการคำนวณ
└─ client/              React (Vite) ธีมสีฟ้า
   ├─ index.html
   └─ src/{main.jsx, App.jsx, Auth.jsx, App.css, api.js}
```

## ตารางในฐานข้อมูล
`users` (บัญชีผู้ใช้) · `bills` (บิล ผูกกับ user) · `people` (คนในบิล) ·
`expenses` (บิลย่อย) · `expense_payers` (ใครออกเงิน) · `expense_participants` (ใครร่วมหาร)

## หลักการคำนวณ (ทำไมถึงแม่นยำ)
ทุกการคำนวณใช้หน่วย **สตางค์ (จำนวนเต็ม)** เพื่อเลี่ยง error จากเลขทศนิยม
เวลาหารไม่ลงตัว เศษสตางค์จะถูกกระจายให้คนแรก ๆ ทีละ 1 สตางค์
จึงรับประกันว่า **ผลรวมที่หารออกมา = ยอดจริงเป๊ะ** และยอดสุทธิของทุกคนรวมกัน = 0 เสมอ
