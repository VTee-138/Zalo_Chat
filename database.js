// database.js
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Pool sẽ quản lý nhiều kết nối cùng lúc, hiệu quả hơn là tạo kết nối mới mỗi lần truy vấn
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Nếu bạn dùng server có SSL (như Heroku, Render), bạn cần thêm dòng sau:
  // ssl: {
  //   rejectUnauthorized: false
  // }
});

// Hàm để kiểm tra kết nối
pool.connect((err, client, release) => {
  if (err) {
    return console.error('Lỗi khi kết nối tới PostgreSQL:', err.stack);
  }
  console.log('✅ Kết nối thành công tới PostgreSQL!');
  release(); // Trả client về pool
});

// Xuất ra một object có phương thức query để các file khác có thể dùng
export default {
  query: (text, params) => pool.query(text, params),
};