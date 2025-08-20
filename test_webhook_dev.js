#!/usr/bin/env node

/**
 * Development Test Script cho Zalo OA Webhook
 * Test trên localhost:3000
 */

import axios from 'axios';

const BASE_URL = 'http://localhost:3000';
const OA_ID = '3592353763697768582'; // OA ID thực tế có trong database

console.log('🚀 Bắt đầu test webhook trên development...');
console.log(`🌍 Testing URL: ${BASE_URL}`);
console.log('===============================================');

const testEvents = [
  {
    event_name: 'user_send_text',
    oa_id: OA_ID,
    app_id: OA_ID,
    timestamp: Date.now(),
    sender: {
      id: 'dev_test_user_123',
      displayName: 'Dev Test User A',
      display_name: 'Dev Test User A',
      avatar: 'https://example.com/avatar.jpg'
    },
    message: {
      text: 'Xin chào từ development test!',
      msg_id: `dev_msg_${Date.now()}_123`
    },
    user_id_by_app: 'dev_test_user_123'
  },
  {
    event_name: 'follow',
    oa_id: OA_ID,
    app_id: OA_ID,
    timestamp: Date.now() + 1000,
    sender: {
      id: 'dev_test_user_456',
      displayName: 'Dev Test User B',
      display_name: 'Dev Test User B'
    },
    user_id_by_app: 'dev_test_user_456'
  },
  {
    event_name: 'user_send_image',
    oa_id: OA_ID,
    app_id: OA_ID,
    timestamp: Date.now() + 2000,
    sender: {
      id: 'dev_test_user_123',
      displayName: 'Dev Test User A',
      display_name: 'Dev Test User A'
    },
    message: {
      msg_id: `dev_msg_${Date.now()}_124`,
      attachments: [{
        type: 'image',
        payload: {
          url: 'https://picsum.photos/300/200'
        }
      }]
    },
    user_id_by_app: 'dev_test_user_123'
  }
];

async function testWebhook() {
  const webhookUrl = `${BASE_URL}/zalo/webhook`;
  
  for (const [index, event] of testEvents.entries()) {
    try {
      console.log(`🧪 Gửi test event: ${event.event_name}`);
      const response = await axios.post(webhookUrl, event, {
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`✅ Response: ${response.status} - ${response.statusText}`);
    } catch (error) {
      console.log(`❌ Error: ${error.response?.status} - ${error.message}`);
    }
    
    // Delay giữa các request
    if (index < testEvents.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
}

async function testAPIs() {
  console.log('\n🔍 Testing API endpoints...');
  
  const endpoints = [
    [`Conversations API`, `${BASE_URL}/api/conversations/${OA_ID}`],
    [`Messages API`, `${BASE_URL}/api/messages/${OA_ID}/dev_test_user_123`]
  ];
  
  for (const [name, url] of endpoints) {
    try {
      console.log(`🧪 Testing ${name}...`);
      const response = await axios.get(url);
      console.log(`✅ ${name}: PASS (${response.status}) - ${response.data.length} records`);
    } catch (error) {
      console.log(`❌ ${name}: FAIL - ${error.message}`);
    }
  }
}

async function runTests() {
  try {
    // Test server availability
    const healthCheck = await axios.get(`${BASE_URL}/`);
    console.log(`✅ Server is running on ${BASE_URL}`);
    
    await testWebhook();
    await testAPIs();
    
    console.log('\n===============================================');
    console.log('🎉 Development testing completed!');
    console.log('💡 Next: Open http://localhost:3000/dashboard in browser');
    
  } catch (error) {
    console.log(`❌ Server không khả dụng: ${error.message}`);
    console.log('💡 Hãy chạy: npm run dev để khởi động server');
  }
}

runTests();
