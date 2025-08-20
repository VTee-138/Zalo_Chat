// personal-chat.js
const socket = io(); // Kết nối đến server
const pathParts = window.location.pathname.split('/');
const USER_ID = pathParts[pathParts.length - 1]; // Lấy User ID từ URL

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.querySelector('.chat-form');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const chatHeader = document.getElementById('chat-header');
const conversationsList = document.getElementById('conversations-list');
const customerInfo = document.getElementById('customer-info');
const currentUserInfo = document.getElementById('current-user-info');

let currentUserId = USER_ID; // ID của user personal account hiện tại
let selectedConversationId = null; // ID của conversation được chọn
let selectedConversation = null;
let userInfo = null;

// Khởi tạo trang
document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUserInfo();
    await loadConversations();
    
    // Join room của user hiện tại
    socket.emit('join_personal_room', currentUserId);
});

// Load thông tin user hiện tại
async function loadCurrentUserInfo() {
    try {
        // Lấy thông tin từ session hoặc API
        const response = await fetch(`/api/personal-profile/${currentUserId}`);
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        userInfo = data;
        currentUserInfo.innerHTML = `
            <div class="user-profile">
                <img src="${data.avatar}" alt="${data.name}" class="user-avatar">
                <div class="user-details">
                    <h4>${data.name}</h4>
                    <p>ID: ${currentUserId}</p>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Lỗi khi tải thông tin user:', error);
        currentUserInfo.innerHTML = `
            <div class="error-info">
                <p>❌ Không thể tải thông tin user</p>
            </div>
        `;
    }
}

// Tải danh sách conversations (từ personal chat API - cần implement)
async function loadConversations() {
    try {
        conversationsList.innerHTML = `
            <div class="loading-conversations">
                <div class="spinner"></div>
                <p>Đang tải cuộc hội thoại...</p>
            </div>
        `;

        // TODO: Implement API để lấy danh sách conversations từ personal account
        // const response = await fetch(`/api/personal-conversations/${currentUserId}`);
        // const conversations = await response.json();
        
        // Tạm thời hiển thị thông báo
        conversationsList.innerHTML = `
            <div class="no-conversations">
                <div class="no-conv-icon">💬</div>
                <h4>Chức năng đang phát triển</h4>
                <p>API lấy danh sách cuộc hội thoại từ tài khoản cá nhân đang được phát triển</p>
                <div class="temp-info">
                    <p><strong>Lưu ý:</strong> Hiện tại chỉ hỗ trợ gửi tin nhắn thử nghiệm</p>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('Lỗi khi tải conversations:', error);
        conversationsList.innerHTML = `
            <div class="error-conversations">
                <p>❌ Lỗi khi tải cuộc hội thoại</p>
                <button onclick="loadConversations()">Thử lại</button>
            </div>
        `;
    }
}

// Chọn một cuộc hội thoại (tạm thời disable)
function selectConversation(conversation) {
    // TODO: Implement khi có API conversations
    console.log('Selected conversation:', conversation);
}

// Xử lý form gửi tin nhắn
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const text = messageInput.value.trim();
    if (!text) return;

    // Tạm thời hiển thị thông báo
    showNotification('Chức năng gửi tin nhắn từ tài khoản cá nhân đang được phát triển', 'info');
    
    // TODO: Implement API gửi tin nhắn từ personal account
    /*
    try {
        const response = await fetch('/api/send-personal-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: currentUserId,
                recipient_id: selectedConversationId,
                text: text
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayMessage({
                sender: 'me',
                text: text,
                timestamp: new Date()
            });
            
            messageInput.value = '';
        } else {
            throw new Error(result.message);
        }
    } catch (error) {
        console.error('Lỗi khi gửi tin nhắn:', error);
        showNotification('Lỗi khi gửi tin nhắn: ' + error.message, 'error');
    }
    */
});

// Hiển thị tin nhắn
function displayMessage(message) {
    const div = document.createElement('div');
    div.classList.add('message');
    
    if (message.sender === 'me') {
        div.classList.add('sent');
    }
    
    div.innerHTML = `
        <div class="message-content">
            <p>${message.text}</p>
            <small>${new Date(message.timestamp).toLocaleTimeString('vi-VN')}</small>
        </div>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hiển thị notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <span>${message}</span>
        <button onclick="this.parentNode.remove()">×</button>
    `;
    
    // Thêm vào container hoặc body
    const container = document.getElementById('notification-container') || document.body;
    container.appendChild(notification);
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

// Lắng nghe events từ server (personal account)
socket.on('personal_message', (data) => {
    console.log('Nhận tin nhắn personal:', data);
    // TODO: Xử lý tin nhắn realtime từ personal account
});

// Cleanup khi rời trang
window.addEventListener('beforeunload', () => {
    socket.emit('leave_personal_room', currentUserId);
});

// Update chat header khi có thông tin user
function updateChatHeader() {
    if (userInfo) {
        chatHeader.innerHTML = `
            <div class="chat-placeholder">
                <div class="placeholder-icon">💬</div>
                <h3>Chào ${userInfo.name}!</h3>
                <p>Giao diện chat cho tài khoản cá nhân đang được phát triển</p>
                <div class="development-note">
                    <h4>🚧 Đang phát triển:</h4>
                    <ul>
                        <li>✅ Xác thực tài khoản cá nhân</li>
                        <li>🔄 API lấy danh sách cuộc hội thoại</li>
                        <li>🔄 Gửi/nhận tin nhắn realtime</li>
                        <li>🔄 Hiển thị lịch sử chat</li>
                    </ul>
                </div>
            </div>
        `;
    }
}

// Gọi update header sau khi load user info
setTimeout(updateChatHeader, 1000);
