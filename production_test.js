#!/usr/bin/env node

/**
 * Production Test Suite cho Zalo OA Chat System
 * Test trên domain: https://chatbot.aipencil.name.vn
 */

import axios from 'axios';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const BASE_URL = 'https://chatbot.aipencil.name.vn';
const OA_ID = '2543059390267371532'; // OA ID từ .env

console.log('🚀 Bắt đầu Production Test Suite...');
console.log(`🌍 Testing domain: ${BASE_URL}`);
console.log('===============================================');

async function testEndpoint(name, url, expectedStatus = 200) {
  try {
    console.log(`🧪 Testing ${name}...`);
    const response = await axios.get(url);
    
    if (response.status === expectedStatus) {
      console.log(`✅ ${name}: PASS (${response.status})`);
      return { success: true, data: response.data };
    } else {
      console.log(`❌ ${name}: FAIL (expected ${expectedStatus}, got ${response.status})`);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log(`❌ ${name}: ERROR - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function testWebhookPost() {
  try {
    console.log(`🧪 Testing Webhook POST...`);
    const testData = {
      app_id: OA_ID,
      oa_id: OA_ID,
      timestamp: Date.now(),
      event_name: 'user_send_text',
      sender: {
        id: 'production_test_user',
        displayName: 'Production Test User',
        display_name: 'Production Test User'
      },
      message: {
        text: 'Production test message',
        msg_id: `prod_test_${Date.now()}`
      },
      user_id_by_app: 'production_test_user'
    };

    const response = await axios.post(`${BASE_URL}/zalo/webhook`, testData, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (response.status === 200) {
      console.log(`✅ Webhook POST: PASS (${response.status})`);
      return { success: true };
    } else {
      console.log(`❌ Webhook POST: FAIL (${response.status})`);
      return { success: false, status: response.status };
    }
  } catch (error) {
    console.log(`❌ Webhook POST: ERROR - ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  const tests = [
    // 1. Test trang chủ
    ['Homepage', `${BASE_URL}/`],
    
    // 2. Test dashboard
    ['Dashboard', `${BASE_URL}/dashboard`],
    
    // 3. Test static files
    ['Main CSS', `${BASE_URL}/style.css`],
    
    // 4. Test API endpoints
    ['API Conversations', `${BASE_URL}/api/conversations/${OA_ID}`],
    ['API Messages', `${BASE_URL}/api/messages/${OA_ID}/test_user_123`],
    
    // 5. Test OAuth endpoints
    ['OAuth Connect', `${BASE_URL}/connect/zalo`],
  ];

  const results = [];
  
  // Run GET tests
  for (const [name, url] of tests) {
    const result = await testEndpoint(name, url);
    results.push({ name, ...result });
    await new Promise(resolve => setTimeout(resolve, 100)); // Rate limiting
  }
  
  // Test POST webhook
  const webhookResult = await testWebhookPost();
  results.push({ name: 'Webhook POST', ...webhookResult });
  
  console.log('\n===============================================');
  console.log('📊 Test Results Summary:');
  console.log('===============================================');
  
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  results.forEach(result => {
    const status = result.success ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} ${result.name}`);
    if (!result.success && result.error) {
      console.log(`    Error: ${result.error}`);
    }
  });
  
  console.log(`\n🎯 Success Rate: ${passed}/${total} (${Math.round((passed/total)*100)}%)`);
  
  if (passed === total) {
    console.log('🎉 All tests passed! Production system is working correctly.');
  } else {
    console.log('⚠️  Some tests failed. Please check the errors above.');
  }
  
  console.log('\n💡 Next steps:');
  console.log('   1. Open https://chatbot.aipencil.name.vn/dashboard in browser');
  console.log('   2. Connect with Zalo OA');
  console.log('   3. Test real-time chat functionality');
  console.log('   4. Send test messages from Zalo app to OA');
}

// Run the tests
runTests().catch(console.error);
