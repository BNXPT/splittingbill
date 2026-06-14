# 🚀 คู่มือ Deploy

ตอนนี้เว็บเก็บข้อมูล **ในเบราว์เซอร์ของแต่ละคน** (localStorage) — ต่างคนต่างข้อมูล ไม่แชร์กัน
ไม่ต้องมีฐานข้อมูลกลาง ไม่ต้องมี backend → เป็นเว็บ **static** ล้วน deploy ง่ายและฟรี

---

## ⭐ วิธีแนะนำ: Render Static Site (ฟรี ไม่หลับ ไม่มีดีเลย์)

1. push โค้ดขึ้น GitHub
2. dashboard.render.com → **New +** → **Static Site**
3. เลือก repo → ตั้งค่า:

| ช่อง | ใส่ค่า |
|------|--------|
| **Root Directory** | `client` |
| **Build Command** | `npm install && npm run build` |
| **Publish Directory** | `dist` |

4. กด **Create Static Site** → รอ build → ได้ลิงก์เว็บ เปิดใช้ได้เลย

> Static Site ของ Render ไม่ "หลับ" เหมือน Web Service จึงเปิดเร็วตลอด ไม่มีดีเลย์ 50 วิ

---

## ทางเลือก: Vercel

1. vercel.com → Add New → Project → เลือก repo
2. ตั้ง **Root Directory** = `client` (สำคัญ! ไม่งั้นจะเจอ `vite: command not found`)
3. Framework = Vite (detect เอง) → กด Deploy
   *(ไม่ต้องตั้ง environment variable ใด ๆ แล้ว)*

---

## ทางเลือก: ใช้ Web Service เดิมบน Render

ถ้ามี Web Service เดิมอยู่แล้ว (Build `npm run build`, Start `npm start`)
แค่ push โค้ดใหม่ → Manual Deploy ก็ใช้ได้เลย (Express จะเสิร์ฟหน้าเว็บให้)
แต่แบบนี้จะมีดีเลย์ตอนเข้าครั้งแรก แนะนำใช้ Static Site จะดีกว่า

---

## คำถามที่พบบ่อย

**เพื่อนเปิดอีกเครื่อง ทำไมไม่เห็นข้อมูลของเรา?**
ถูกต้องแล้ว — ตอนนี้ข้อมูลเก็บแยกในเบราว์เซอร์ของแต่ละคน ใครกรอกของใครก็เห็นแค่ของตัวเอง

**ข้อมูลหายไหม?**
ข้อมูลอยู่ในเบราว์เซอร์ ถ้าไม่ล้าง cache/ประวัติ ก็อยู่ตลอด แต่ถ้าเปลี่ยนเครื่อง/เบราว์เซอร์ หรือเปิดโหมดไม่ระบุตัวตน จะไม่เห็นข้อมูลเดิม

**เปิดลิงก์แล้วเจอ Cannot GET / ?**
นั่นคือ Web Service แบบ API เก่า — ใช้ **Static Site** ตามวิธีแนะนำด้านบนแทน จะเจอหน้าเว็บเลย
