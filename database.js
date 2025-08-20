// database.js (Phiên bản cập nhật)
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Pool sẽ đọc các biến môi trường riêng biệt
const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  // Nếu bạn dùng server có SSL, bạn vẫn có thể thêm cấu hình ssl ở đây
  // ssl: {
  //   rejectUnauthorized: false
  // }
});

// Hàm để kiểm tra kết nối (giữ nguyên)
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Lỗi khi kết nối tới PostgreSQL:', err.stack);
  }
  console.log('✅ Kết nối thành công tới PostgreSQL!');
  release();
});

// Xuất ra một object có phương thức query (giữ nguyên)
export default {
  query: (text, params) => pool.query(text, params),
};