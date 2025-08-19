// worker.js
import axios from 'axios';
import dotenv from 'dotenv';
import db from './database.js';

dotenv.config();

const { ZALO_APP_ID, ZALO_APP_SECRET } = process.env;

/**
 * Hàm này nhận vào một bản ghi token từ DB và thực hiện làm mới nó.
 * @param {object} tokenRecord - Một object chứa thông tin token từ bảng zalo_tokens
 */
async function refreshZaloToken(tokenRecord) {
  const { oa_id, refresh_token } = tokenRecord;
  console.log(`🔄 Bắt đầu quá trình làm mới token cho OA ID: ${oa_id}...`);

  try {
    const form = new URLSearchParams({
      grant_type: 'refresh_token',
      app_id: ZALO_APP_ID,
      refresh_token: refresh_token,
    });

    const response = await axios.post(
      'https://oauth.zaloapp.com/v4/oa/access_token',
      form.toString(),
      {
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          secret_key: ZALO_APP_SECRET,
        },
      }
    );

    const { access_token: new_access_token, refresh_token: new_refresh_token, expires_in } = response.data;
    
    // QUAN TRỌNG: Zalo trả về refresh_token mới, ta phải dùng nó cho lần sau.
    if (!new_access_token || !new_refresh_token) {
        throw new Error('Phản hồi từ Zalo API không chứa token mới.');
    }

    const newExpiresAt = new Date(Date.now() + (expires_in - 300) * 1000); // Trừ đi 5 phút

    const updateQuery = `
      UPDATE zalo_tokens
      SET access_token = $1, refresh_token = $2, expires_at = $3
      WHERE oa_id = $4;
    `;
    
    await db.query(updateQuery, [new_access_token, new_refresh_token, newExpiresAt, oa_id]);
    
    console.log(`✅ Làm mới token thành công cho OA ID: ${oa_id}.`);

  } catch (error) {
    const errorMessage = error.response?.data?.error_name || error.message;
    console.error(`❌ Lỗi khi làm mới token cho OA ID: ${oa_id}. Lỗi: ${errorMessage}`);
    
    // Xử lý trường hợp refresh_token không hợp lệ, có thể cần yêu cầu người dùng kết nối lại.
    if (errorMessage === 'invalid_grant') {
      console.error(`   -> Refresh token cho OA ${oa_id} đã không còn hợp lệ. Cần kết nối lại.`);
      // TODO: Cập nhật trạng thái trong CSDL để báo cho admin biết OA này cần kết nối lại.
    }
  }
}

/**
 * Hàm chính của worker, chạy liên tục để kiểm tra các token sắp hết hạn.
 */
async function runWorker() {
  console.log('⚙️ Worker đang chạy, tìm kiếm các token sắp hết hạn...');

  try {
    // Chỉ lấy những token sẽ hết hạn trong 10 phút tới để giảm tải
    const selectQuery = `
      SELECT * FROM zalo_tokens
      WHERE expires_at < NOW() + INTERVAL '10 minutes';
    `;
    const { rows: expiringTokens } = await db.query(selectQuery);

    if (expiringTokens.length === 0) {
      console.log('   -> Không tìm thấy token nào sắp hết hạn.');
      return;
    }

    console.log(`   -> Tìm thấy ${expiringTokens.length} token cần làm mới. Bắt đầu xử lý...`);

    // Dùng Promise.all để các tiến trình refresh có thể chạy song song
    await Promise.all(expiringTokens.map(token => refreshZaloToken(token)));

  } catch (error) {
    console.error('Lỗi nghiêm trọng trong worker:', error);
  }
}

// === KHỞI ĐỘNG WORKER ===
console.log('🚀 Khởi động Zalo Token Refresh Worker...');

// Chạy ngay lần đầu tiên
runWorker();

// Sau đó lặp lại mỗi 60 giây (60,000 mili giây)
setInterval(runWorker, 60000);