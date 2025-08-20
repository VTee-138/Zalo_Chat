// public/main.js
const socket = io(); // Kết nối đến server
const pathParts = window.location.pathname.split('/');
const OA_ID = pathParts[pathParts.length - 1]; // Lấy OA ID từ URL

const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const messageInput = document.getElementById('message-input');
const chatHeader = document.getElementById('chat-header');
const conversationList = document.querySelector('.conversations');
const customerInfo = document.getElementById('customer-info');

let current_oa_id = OA_ID; // Lấy từ URL
let current_user_id = null; // Sẽ được set khi chọn conversation
let selectedConversation = null;

// Khởi tạo trang
document.addEventListener('DOMContentLoaded', async () => {
    chatHeader.innerHTML = `<h3>Chat với OA: ${current_oa_id}</h3><p>Chọn một cuộc hội thoại từ danh sách bên trái</p>`;
    
    // Join room của OA hiện tại
    socket.emit('join_oa_room', current_oa_id);
    
    await loadConversations();
});

// Tải danh sách hội thoại
async function loadConversations() {
    try {
        const response = await fetch(`/api/conversations/${current_oa_id}`);
        const conversations = await response.json();
        
        conversationList.innerHTML = '';
        
        if (conversations.length === 0) {
            conversationList.innerHTML = '<p style="padding: 15px; color: #888; text-align: center;">Chưa có hội thoại nào</p>';
            return;
        }
        
        conversations.forEach(conv => {
            const conversationDiv = document.createElement('div');
            conversationDiv.className = 'conversation-item';
            conversationDiv.dataset.userId = conv.user_id;
            conversationDiv.innerHTML = `
                <div class="conversation-avatar">👤</div>
                <div class="conversation-content">
                    <h4>${conv.display_name || 'Người dùng ' + conv.user_id.substr(-4)}</h4>
                    <p class="last-message">${conv.last_message || 'Chưa có tin nhắn'}</p>
                    <small>${new Date(conv.received_at).toLocaleString('vi-VN')}</small>
                </div>
            `;
            
            conversationDiv.addEventListener('click', () => selectConversation(conv));
            conversationList.appendChild(conversationDiv);
        });
    } catch (error) {
        console.error('Lỗi khi tải danh sách hội thoại:', error);
        conversationList.innerHTML = '<p style="padding: 15px; color: #red;">Lỗi khi tải danh sách</p>';
    }
}

// Chọn một cuộc hội thoại
async function selectConversation(conversation) {
    // Highlight conversation được chọn
    document.querySelectorAll('.conversation-item').forEach(item => {
        item.classList.remove('active');
    });
    
    const selectedElement = document.querySelector(`[data-user-id="${conversation.user_id}"]`);
    if (selectedElement) {
        selectedElement.classList.add('active');
    }
    
    current_user_id = conversation.user_id;
    selectedConversation = conversation;
    
    // Cập nhật header
    chatHeader.innerHTML = `
        <div class="chat-header-content">
            <div class="user-avatar">👤</div>
            <div class="user-info">
                <h3>${conversation.display_name || 'Người dùng ' + conversation.user_id.substr(-4)}</h3>
                <p>ID: ${conversation.user_id}</p>
            </div>
        </div>
    `;
    
    // Cập nhật thông tin khách hàng
    customerInfo.innerHTML = `
        <h4>Thông tin khách hàng</h4>
        <p><strong>Tên:</strong> ${conversation.display_name || 'Chưa có tên'}</p>
        <p><strong>User ID:</strong> ${conversation.user_id}</p>
        <p><strong>Tin nhắn cuối:</strong> ${new Date(conversation.received_at).toLocaleString('vi-VN')}</p>
    `;
    
    // Hiện form chat
    chatForm.style.display = 'flex';
    
    // Tải lịch sử tin nhắn
    await loadMessageHistory();
}

// Tải lịch sử tin nhắn của một người dùng
async function loadMessageHistory() {
    if (!current_user_id) return;
    
    try {
        const response = await fetch(`/api/messages/${current_oa_id}/${current_user_id}`);
        const messages = await response.json();
        
        chatMessages.innerHTML = '';
        
        messages.forEach(msgEvent => {
            displayMessageFromEvent(msgEvent);
        });
        
        // Cuộn xuống cuối
        chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
        console.error('Lỗi khi tải lịch sử tin nhắn:', error);
    }
}

// Hiển thị tin nhắn từ event database
function displayMessageFromEvent(eventData) {
    const { event_type, payload, received_at } = eventData;
    
    const div = document.createElement('div');
    div.classList.add('message');
    
    let content = '';
    let isFromUser = false;
    
    // Xác định loại tin nhắn và hiển thị
    if (event_type.startsWith('user_send')) {
        isFromUser = true;
        content = formatMessageContent(event_type, payload);
    } else if (event_type.startsWith('oa_send')) {
        isFromUser = false;
        content = formatMessageContent(event_type, payload);
    } else {
        return; // Bỏ qua các event khác
    }
    
    if (!isFromUser) {
        div.classList.add('sent');
    }
    
    div.innerHTML = `
        <div class="message-content">
            ${content}
            <small>${new Date(received_at).toLocaleTimeString('vi-VN')}</small>
        </div>
    `;
    
    chatMessages.appendChild(div);
}

// Format nội dung tin nhắn theo loại
function formatMessageContent(eventType, payload) {
    const message = payload.message;
    
    switch (eventType) {
        case 'user_send_text':
        case 'oa_send_text':
            return `<p>${message?.text || '[Tin nhắn text]'}</p>`;
            
        case 'user_send_image':
        case 'oa_send_image':
            const imageUrl = message?.attachments?.[0]?.payload?.url;
            return `
                <div class="message-image">
                    <p>📷 Hình ảnh</p>
                    ${imageUrl ? `<img src="${imageUrl}" alt="Image" style="max-width: 200px; border-radius: 8px;" onclick="window.open('${imageUrl}', '_blank')">` : ''}
                </div>
            `;
            
        case 'user_send_audio':
        case 'oa_send_audio':
            const audioUrl = message?.attachments?.[0]?.payload?.url;
            return `
                <div class="message-audio">
                    <p>🎵 Tin nhắn voice</p>
                    ${audioUrl ? `<audio controls><source src="${audioUrl}" type="audio/mpeg"></audio>` : ''}
                </div>
            `;
            
        case 'user_send_sticker':
        case 'oa_send_sticker':
            const stickerUrl = message?.attachments?.[0]?.payload?.url;
            return `
                <div class="message-sticker">
                    <p>😄 Sticker</p>
                    ${stickerUrl ? `<img src="${stickerUrl}" alt="Sticker" style="max-width: 100px;">` : ''}
                </div>
            `;
            
        case 'user_send_gif':
        case 'oa_send_gif':
            const gifUrl = message?.attachments?.[0]?.payload?.url;
            return `
                <div class="message-gif">
                    <p>🎬 GIF</p>
                    ${gifUrl ? `<img src="${gifUrl}" alt="GIF" style="max-width: 200px; border-radius: 8px;">` : ''}
                </div>
            `;
            
        case 'user_send_link':
        case 'oa_send_link':
            const linkUrl = message?.attachments?.[0]?.payload?.url;
            const linkTitle = message?.attachments?.[0]?.payload?.title;
            return `
                <div class="message-link">
                    <p>🔗 Link</p>
                    ${linkUrl ? `<a href="${linkUrl}" target="_blank" rel="noopener">${linkTitle || linkUrl}</a>` : ''}
                </div>
            `;
            
        case 'user_send_location':
        case 'oa_send_location':
            const location = message?.attachments?.[0]?.payload;
            return `
                <div class="message-location">
                    <p>📍 Vị trí</p>
                    ${location ? `<p>Tọa độ: ${location.coordinates?.lat}, ${location.coordinates?.long}</p>` : ''}
                </div>
            `;
            
        case 'follow':
            return `<p class="system-message">🎉 Đã theo dõi OA</p>`;
            
        case 'unfollow':
            return `<p class="system-message">👋 Đã bỏ theo dõi OA</p>`;
            
        default:
            return `<p>[${eventType}]</p>`;
    }
}

// Hiển thị tin nhắn realtime từ webhook
function displayMessage(event) {
    const div = document.createElement('div');
    div.classList.add('message');

    let content = '';
    let isFromUser = false;
    
    // Phân tích sự kiện từ Zalo
    if (event.event_name.startsWith('user_send')) {
        isFromUser = true;
        content = formatMessageContent(event.event_name, event);
    } else if (event.event_name.startsWith('oa_send')) {
        isFromUser = false;
        content = formatMessageContent(event.event_name, event);
    } else if (event.event_name === 'follow' || event.event_name === 'unfollow') {
        content = formatMessageContent(event.event_name, event);
        isFromUser = false;
    } else {
        return; // Bỏ qua các sự kiện không phải tin nhắn
    }

    if (!isFromUser) {
        div.classList.add('sent');
    }

    div.innerHTML = `
        <div class="message-content">
            ${content}
            <small>${new Date().toLocaleTimeString('vi-VN')}</small>
        </div>
    `;
    
    chatMessages.appendChild(div);
    chatMessages.scrollTop = chatMessages.scrollHeight; // Tự cuộn xuống
}

// Lắng nghe sự kiện 'zalo_event' từ server
socket.on('zalo_event', (event) => {
    console.log('Nhận được sự kiện từ Zalo:', event);
    
    // Chỉ xử lý event của OA hiện tại
    if (event.oa_id === current_oa_id) {
        const senderName = event.sender?.display_name || 
                          event.sender?.displayName || 
                          'Người dùng ' + (event.sender?.id ? event.sender.id.substr(-4) : 'Unknown');
        
        // Nếu đang chat với user này, hiển thị tin nhắn ngay
        if (current_user_id && event.sender && event.sender.id === current_user_id) {
            displayMessage(event);
        } 
        // Nếu không phải user đang chat, hiển thị notification
        else if (event.event_name.startsWith('user_send') || event.event_name === 'follow') {
            const messagePreview = getMessagePreview(event.event_name, event);
            showNewMessageNotification(senderName, messagePreview);
        }
        
        // Cập nhật lại danh sách conversation nếu có tin nhắn mới từ user khác
        if (event.event_name === 'user_send_text' || event.event_name === 'follow') {
            setTimeout(() => loadConversations(), 1000); // Delay 1s để DB cập nhật
        }
    }
});

// Xử lý khi form gửi tin nhắn được submit
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!current_user_id) {
        alert('Vui lòng chọn một cuộc hội thoại trước khi gửi tin nhắn!');
        return;
    }
    
    const text = messageInput.value.trim();
    if (!text) return;

    try {
        // Gửi tin nhắn đến server qua API
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                oa_id: current_oa_id,
                user_id: current_user_id,
                text: text
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Hiển thị tin nhắn vừa gửi lên giao diện ngay lập tức
            const sentEvent = {
                event_name: 'oa_send_text',
                message: { text: text }
            };
            displayMessage(sentEvent);
            
            messageInput.value = '';
            messageInput.focus();
        } else {
            alert('Lỗi khi gửi tin nhắn: ' + result.message);
        }
    } catch (error) {
        console.error('Lỗi khi gửi tin nhắn:', error);
        alert('Có lỗi xảy ra khi gửi tin nhắn');
    }
});

// Hiển thị notification tin nhắn mới
function showNewMessageNotification(senderName, messagePreview) {
    // Tạo notification element
    const notification = document.createElement('div');
    notification.className = 'new-message-notification';
    notification.innerHTML = `
        <strong>💬 Tin nhắn mới từ ${senderName}</strong>
        <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9;">${messagePreview}</p>
    `;
    
    // Thêm vào body
    document.body.appendChild(notification);
    
    // Tự động ẩn sau 5 giây
    setTimeout(() => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 5000);
    
    // Click để ẩn
    notification.addEventListener('click', () => {
        notification.style.animation = 'slideInRight 0.3s ease reverse';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    });
}

// Lấy preview text từ message content
function getMessagePreview(eventType, payload) {
    switch (eventType) {
        case 'user_send_text':
            return payload.message?.text?.substring(0, 50) + (payload.message?.text?.length > 50 ? '...' : '') || 'Tin nhắn văn bản';
        case 'user_send_image':
            return '📷 Đã gửi hình ảnh';
        case 'user_send_audio':
            return '🎵 Đã gửi voice message';
        case 'user_send_sticker':
            return '😄 Đã gửi sticker';
        case 'user_send_gif':
            return '🎬 Đã gửi GIF';
        case 'user_send_link':
            return '🔗 Đã gửi link';
        case 'user_send_location':
            return '📍 Đã chia sẻ vị trí';
        case 'follow':
            return '🎉 Đã theo dõi OA';
        default:
            return 'Tin nhắn mới';
    }
}

// Ngắt kết nối khỏi room khi rời trang
window.addEventListener('beforeunload', () => {
    socket.emit('leave_oa_room', current_oa_id);
});