// เลือก adapter อัตโนมัติ:
//  - มี DATABASE_URL  -> PostgreSQL (สำหรับ deploy บน cloud เช่น Render)
//  - ไม่มี            -> SQLite ไฟล์ local (สำหรับรันในเครื่อง)
const usePostgres = !!process.env.DATABASE_URL;
const repo = usePostgres ? require('./postgres') : require('./sqlite');
repo.kind = usePostgres ? 'postgres' : 'sqlite';
module.exports = repo;
