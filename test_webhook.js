// test_webhook.js - Script để test webhook trên production
import axios from 'axios';

const TEST_WEBHOOK_URL = 'https://chatbot.aipencil.name.vn/zalo/webhook';

// Test data mẫu - sử dụng OA ID thực từ .env
const testEvents = [
    // Test tin nhắn văn bản
    {
        app_id: '2543059390267371532',
        user_id_by_app: 'test_user_123',
        oa_id: '2543059390267371532',
        event_name: 'user_send_text',
        message: {
            msg_id: 'msg_' + Date.now() + '_123',
            text: 'Xin chào, tôi muốn tư vấn dịch vụ'
        },
        sender: {
            id: 'test_user_123',
            display_name: 'Nguyễn Văn A',
            displayName: 'Nguyễn Văn A',
            avatar: 'https://example.com/avatar.jpg'
        },
        timestamp: Date.now()
    },
    
    // Test follow
    {
        app_id: '2543059390267371532',
        user_id_by_app: 'test_user_456',
        oa_id: '2543059390267371532',
        event_name: 'follow',
        sender: {
            id: 'test_user_456',
            display_name: 'Trần Thị B',
            displayName: 'Trần Thị B'
        },
        timestamp: Date.now()
    },
    
    // Test tin nhắn hình ảnh
    {
        app_id: '2543059390267371532',
        user_id_by_app: 'test_user_123',
        oa_id: '2543059390267371532',
        event_name: 'user_send_image',
        message: {
            msg_id: 'msg_' + Date.now() + '_124',
            attachments: [{
                type: 'image',
                payload: {
                    url: 'https://picsum.photos/300/200'
                }
            }]
        },
        sender: {
            id: 'test_user_123',
            display_name: 'Nguyễn Văn A',
            displayName: 'Nguyễn Văn A'
        },
        timestamp: Date.now()
    },
    
    // Test sticker
    {
        app_id: '2543059390267371532',
        user_id_by_app: 'test_user_123',
        oa_id: '2543059390267371532',
        event_name: 'user_send_sticker',
        message: {
            msg_id: 'msg_' + Date.now() + '_125',
            attachments: [{
                type: 'sticker',
                payload: {
                    url: 'https://stc-developers.zdn.vn/images/bg_1.jpg'
                }
            }]
        },
        sender: {
            id: 'test_user_123',
            display_name: 'Nguyễn Văn A',
            displayName: 'Nguyễn Văn A'
        },
        timestamp: Date.now()
    },
    
    // Test tin nhắn thứ 2 từ user khác
    {
        app_id: '2543059390267371532',
        user_id_by_app: 'test_user_789',
        oa_id: '2543059390267371532',
        event_name: 'user_send_text',
        message: {
            msg_id: 'msg_' + Date.now() + '_789',
            text: 'Tôi cần hỗ trợ về sản phẩm'
        },
        sender: {
            id: 'test_user_789',
            display_name: 'Lê Văn C',
            displayName: 'Lê Văn C',
            avatar: 'https://example.com/avatar2.jpg'
        },
        timestamp: Date.now()
    }
];

async function sendTestEvent(event, delay = 2000) {
    try {
        console.log(`🧪 Gửi test event: ${event.event_name}`);
        const response = await axios.post(TEST_WEBHOOK_URL, event);
        console.log(`✅ Response: ${response.status} - ${response.data}`);
    } catch (error) {
        console.error(`❌ Lỗi khi gửi event:`, error.response?.data || error.message);
    }
    
    // Đợi một chút trước khi gửi event tiếp theo
    if (delay > 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }
}

async function runTest() {
    console.log('🚀 Bắt đầu test webhook...');
    console.log(`📡 Webhook URL: ${TEST_WEBHOOK_URL}`);
    console.log('===============================================');
    
    for (let i = 0; i < testEvents.length; i++) {
        const event = testEvents[i];
        await sendTestEvent(event, i < testEvents.length - 1 ? 3000 : 0);
    }
    
    console.log('===============================================');
    console.log('🎉 Hoàn thành test webhook!');
    console.log('💡 Kiểm tra giao diện chat để xem kết quả');
}

// Chạy test
runTest().catch(console.error);
