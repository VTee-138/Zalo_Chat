// zalo_api.js
import axios from 'axios';
import db from './database.js';

/**
 * Lấy access token hợp lệ từ CSDL cho một OA cụ thể.
 * @param {string} oa_id - ID của Official Account.
 * @returns {Promise<string|null>} Access token hoặc null nếu không tìm thấy/lỗi.
 */
export async function getValidAccessToken(oa_id) {
  try {
    const query = 'SELECT access_token FROM zalo_tokens WHERE oa_id = $1 AND expires_at > NOW()';
    const result = await db.query(query, [oa_id]);
    if (result.rows.length > 0) {
      return result.rows[0].access_token;
    }
    console.error(`Không tìm thấy access token hợp lệ cho OA ID: ${oa_id}`);
    return null;
  } catch (error) {
    console.error('Lỗi khi lấy access token từ DB:', error);
    return null;
  }
}

/**
 * Gửi tin nhắn văn bản đến một người dùng cụ thể.
 * @param {string} oa_id - ID của OA gửi tin.
 * @param {string} user_id - ID của người dùng nhận tin.
 * @param {string} text - Nội dung tin nhắn.
 * @returns {Promise<boolean>} True nếu thành công, False nếu thất bại.
 */
export async function sendTextMessage(oa_id, user_id, text) {
  const accessToken = await getValidAccessToken(oa_id);
  if (!accessToken) {
    console.error(`Không thể gửi tin nhắn vì thiếu access token cho OA ${oa_id}`);
    return false;
  }

  try {
    const response = await axios.post(
      'https://openapi.zalo.me/v3.0/oa/message/cs',
      {
        recipient: { user_id: user_id },
        message: { text: text },
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.error === 0) {
      console.log(`✅ Gửi tin nhắn thành công đến user ${user_id}`);
      return true;
    } else {
      console.error(`Lỗi khi gửi tin nhắn từ Zalo API: ${response.data.message}`);
      return false;
    }
  } catch (error) {
    console.error('Lỗi nghiêm trọng khi gọi API gửi tin nhắn:', error.response?.data || error.message);
    return false;
  }
}