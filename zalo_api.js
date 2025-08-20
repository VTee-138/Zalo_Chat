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
 * Crawl tất cả tin nhắn từ Zalo OA API và lưu vào database
 * @param {string} oa_id - ID của Official Account.
 * @param {number} limit - Số lượng tin nhắn tối đa mỗi lần gọi (mặc định 20).
 * @returns {Promise<boolean>} True nếu thành công, False nếu thất bại.
 */
export async function crawlMessagesFromZalo(oa_id, limit = 20) {
  const accessToken = await getValidAccessToken(oa_id);
  if (!accessToken) {
    console.error(`Không thể crawl tin nhắn vì thiếu access token cho OA ${oa_id}`);
    return false;
  }

  try {
    let offset = 0;
    let hasMore = true;
    let totalCrawled = 0;

    console.log(`🔄 Bắt đầu crawl tin nhắn cho OA ${oa_id}...`);

    while (hasMore) {
      // Gọi API lấy danh sách cuộc hội thoại
      const conversationsResponse = await axios.get(
        `https://openapi.zalo.me/v3.0/oa/conversation/list?data={"offset":${offset},"limit":${limit}}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (conversationsResponse.data.error !== 0) {
        console.error(`Lỗi khi lấy danh sách hội thoại: ${conversationsResponse.data.message}`);
        break;
      }

      const conversations = conversationsResponse.data.data || [];
      console.log(`📋 Tìm thấy ${conversations.length} cuộc hội thoại tại offset ${offset}`);

      if (conversations.length === 0) {
        hasMore = false;
        break;
      }

      // Lấy tin nhắn cho từng cuộc hội thoại
      for (const conversation of conversations) {
        const userId = conversation.user_id;
        console.log(`💬 Đang crawl tin nhắn cho user: ${userId}`);

        try {
          // Lấy tin nhắn của cuộc hội thoại này
          const messagesResponse = await axios.get(
            `https://openapi.zalo.me/v3.0/oa/conversation/getmessage?data={"user_id":"${userId}","offset":0,"limit":50}`,
            {
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
              },
            }
          );

          if (messagesResponse.data.error === 0) {
            const messages = messagesResponse.data.data || [];
            console.log(`📨 Tìm thấy ${messages.length} tin nhắn cho user ${userId}`);

            // Lưu từng tin nhắn vào database
            for (const message of messages) {
              await saveMessageToDatabase(oa_id, message, userId);
              totalCrawled++;
            }
          } else {
            console.error(`Lỗi khi lấy tin nhắn cho user ${userId}: ${messagesResponse.data.message}`);
          }

          // Delay giữa các request để tránh rate limit
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (messageError) {
          console.error(`Lỗi khi xử lý tin nhắn cho user ${userId}:`, messageError.message);
        }
      }

      offset += limit;
      
      // Kiểm tra nếu số lượng conversation trả về ít hơn limit thì đã hết
      if (conversations.length < limit) {
        hasMore = false;
      }

      // Delay giữa các page để tránh rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`✅ Hoàn thành crawl! Tổng cộng ${totalCrawled} tin nhắn đã được lưu vào database.`);
    return true;

  } catch (error) {
    console.error('Lỗi nghiêm trọng khi crawl tin nhắn:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Lưu tin nhắn vào database dưới dạng webhook event
 * @param {string} oa_id - ID của OA
 * @param {object} message - Tin nhắn từ Zalo API
 * @param {string} userId - ID của user
 */
async function saveMessageToDatabase(oa_id, message, userId) {
  try {
    // Chuyển đổi message từ Zalo API thành format webhook event
    const eventType = message.from_id === oa_id ? 'oa_send_text' : 'user_send_text';
    
    // Tạo fake event payload giống webhook
    const fakeWebhookEvent = {
      app_id: oa_id,
      user_id_by_app: userId,
      oa_id: oa_id,
      event_name: eventType,
      message: {
        msg_id: message.msg_id,
        text: message.message || message.text,
        attachments: message.attachments || []
      },
      sender: {
        id: message.from_id === oa_id ? oa_id : userId,
        display_name: message.from_name || 'Unknown User'
      },
      recipient: {
        id: message.from_id === oa_id ? userId : oa_id
      },
      timestamp: message.time || Date.now()
    };

    // Kiểm tra xem tin nhắn đã tồn tại chưa (để tránh duplicate)
    const checkQuery = 'SELECT id FROM webhook_events WHERE payload->>\'message\'->>\'msg_id\' = $1';
    const existingMessage = await db.query(checkQuery, [message.msg_id]);

    if (existingMessage.rows.length === 0) {
      // Lưu vào database
      const insertQuery = 'INSERT INTO webhook_events (oa_id, event_type, payload, received_at) VALUES ($1, $2, $3, $4)';
      const receivedAt = new Date(message.time || Date.now());
      
      await db.query(insertQuery, [oa_id, eventType, fakeWebhookEvent, receivedAt]);
      console.log(`💾 Đã lưu tin nhắn ${message.msg_id} vào database`);
    } else {
      console.log(`⏭️ Tin nhắn ${message.msg_id} đã tồn tại, bỏ qua`);
    }

  } catch (error) {
    console.error(`Lỗi khi lưu tin nhắn ${message.msg_id}:`, error.message);
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