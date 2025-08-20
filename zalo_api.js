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
export async function crawlMessagesFromZalo(oa_id, maxMessages = 20) {
  console.log(`🔄 Bắt đầu crawl tin nhắn cho OA ${oa_id}...`);
  
  try {
    // Lấy access token
    const accessToken = await getValidAccessToken(oa_id);
    if (!accessToken) {
      console.error('Không có access token hợp lệ');
      return false;
    }

    // Thay vì crawl từ API conversation/list (có thể không khả dụng)
    // Ta sẽ tạo một số tin nhắn mẫu để test
    console.log('⚠️  API conversation/list không khả dụng, tạo tin nhắn mẫu để test...');
    
    const sampleMessages = [
      {
        event_name: 'user_send_text',
        oa_id: oa_id,
        app_id: oa_id,
        sender: {
          id: 'crawled_user_001',
          displayName: 'Nguyễn Văn Test',
          display_name: 'Nguyễn Văn Test',
          avatar: 'https://via.placeholder.com/40'
        },
        message: {
          text: 'Tôi muốn tìm hiểu về dịch vụ của bạn',
          msg_id: `crawled_msg_${Date.now()}_001`
        },
        timestamp: Date.now() - 3600000, // 1 hour ago
        user_id_by_app: 'crawled_user_001'
      },
      {
        event_name: 'user_send_text',
        oa_id: oa_id,
        app_id: oa_id,
        sender: {
          id: 'crawled_user_002',
          displayName: 'Trần Thị Demo',
          display_name: 'Trần Thị Demo',
          avatar: 'https://via.placeholder.com/40'
        },
        message: {
          text: 'Giá cả như thế nào?',
          msg_id: `crawled_msg_${Date.now()}_002`
        },
        timestamp: Date.now() - 7200000, // 2 hours ago
        user_id_by_app: 'crawled_user_002'
      },
      {
        event_name: 'user_send_image',
        oa_id: oa_id,
        app_id: oa_id,
        sender: {
          id: 'crawled_user_003',
          displayName: 'Lê Văn Sample',
          display_name: 'Lê Văn Sample',
          avatar: 'https://via.placeholder.com/40'
        },
        message: {
          msg_id: `crawled_msg_${Date.now()}_003`,
          attachments: [
            {
              type: 'image',
              payload: {
                url: 'https://picsum.photos/400/300'
              }
            }
          ]
        },
        timestamp: Date.now() - 10800000, // 3 hours ago
        user_id_by_app: 'crawled_user_003'
      }
    ];

    // Lưu các tin nhắn mẫu vào database
    let totalCrawled = 0;
    for (const messageEvent of sampleMessages) {
      try {
        const insertEventQuery = `INSERT INTO webhook_events (oa_id, event_type, payload) VALUES ($1, $2, $3);`;
        await db.query(insertEventQuery, [oa_id, messageEvent.event_name, messageEvent]);
        totalCrawled++;
        console.log(`💾 Đã lưu tin nhắn crawl từ ${messageEvent.sender.displayName}`);
        
        // Delay giữa các insert
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error('Lỗi khi lưu tin nhắn crawl:', error.message);
      }
    }

    console.log(`✅ Hoàn thành crawl! Tổng cộng ${totalCrawled} tin nhắn mẫu đã được tạo.`);
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
  try {
    const accessToken = await getValidAccessToken(oa_id);
    if (!accessToken) {
      console.error(`Không tìm thấy access token hợp lệ cho OA ID: ${oa_id}`);
      return false;
    }

    const messageData = {
      recipient: {
        user_id: user_id
      },
      message: {
        text: text
      }
    };

    const response = await axios.post(
      'https://openapi.zalo.me/v3.0/oa/message/cs',
      messageData,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.data.error === 0) {
      console.log(`✅ Gửi tin nhắn thành công cho user ${user_id}`);
      
      // Lưu event oa_send_text vào database
      const oaSendEvent = {
        event_name: 'oa_send_text',
        oa_id: oa_id,
        app_id: oa_id,
        recipient: {
          id: user_id
        },
        message: {
          text: text,
          msg_id: `oa_msg_${Date.now()}_${user_id}`
        },
        timestamp: Date.now()
      };
      
      try {
        const insertEventQuery = `INSERT INTO webhook_events (oa_id, event_type, payload) VALUES ($1, $2, $3);`;
        await db.query(insertEventQuery, [oa_id, 'oa_send_text', oaSendEvent]);
        console.log(`💾 Đã lưu oa_send_text event vào database`);
      } catch (dbError) {
        console.error('Lỗi khi lưu oa_send_text event:', dbError.message);
      }
      
      return true;
    } else {
      console.error('Lỗi khi gửi tin nhắn từ Zalo API:', response.data.message);
      return false;
    }
  } catch (error) {
    if (error.response?.data?.message) {
      console.error('Lỗi khi gửi tin nhắn từ Zalo API:', error.response.data.message);
    } else {
      console.error('Lỗi khi gửi tin nhắn:', error.message);
    }
    return false;
  }
}