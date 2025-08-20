// public/main.js
const socket = io(); // Kết nối đến server
const pathParts = window.location.pathname.split('/');
const OA_ID = pathParts[pathParts.length - 1];
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const userIdSpan = document.getElementById('user-id');

// ---- PHẦN NÀY DÙNG ĐỂ TEST, CẦN LÀM ĐỘNG SAU NÀY ----
// Trong một ứng dụng thật, bạn sẽ cần cơ chế để chọn đúng oa_id và user_id đang chat
let current_oa_id = 'YOUR_OA_ID'; // <-- THAY BẰNG OA ID CỦA BẠN
let current_user_id = 'USER_ID_TO_CHAT_WITH'; // <-- THAY BẰNG USER ID BẠN MUỐN CHAT
userIdSpan.textContent = current_user_id;
// --------------------------------------------------

// Hàm để hiển thị tin nhắn lên giao diện
function displayMessage(event) {
    const div = document.createElement('div');
    div.classList.add('message');

    let content = '';
    let sender = 'user'; // Mặc định là người dùng gửi
    
    // Phân tích sự kiện từ Zalo
    if (event.event_name.startsWith('user_send')) {
        sender = 'user';
        if (event.message.text) content = event.message.text;
        else content = `[${event.event_name}]`;
    } else if (event.event_name.startsWith('oa_send')) {
        sender = 'oa';
        if (event.message.text) content = event.message.text;
        else content = `[${event.event_name}]`;
    } else {
        return; // Bỏ qua các sự kiện không phải tin nhắn
    }

    if (sender === 'oa') {
        div.classList.add('sent');
    }

    div.innerHTML = `<p>${content}</p>`;
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Tự cuộn xuống
}

// Lắng nghe sự kiện 'zalo_event' từ server
socket.on('zalo_event', (event) => {
    console.log('Nhận được sự kiện từ Zalo:', event);
    // Chỉ hiển thị tin nhắn của user đang chat
    if (event.sender && event.sender.id === current_user_id) {
        displayMessage(event);
    }
});

// Xử lý khi form gửi tin nhắn được submit
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = messageInput.value.trim();
    if (!text) return;

    // Gửi tin nhắn đến server qua API
    await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            oa_id: current_oa_id,
            user_id: current_user_id,
            text: text
        })
    });
    
    // Hiển thị tin nhắn vừa gửi lên giao diện ngay lập tức
    const sentEvent = {
        event_name: 'oa_send_text',
        message: { text: text }
    };
    displayMessage(sentEvent);

    messageInput.value = '';
    messageInput.focus();
});