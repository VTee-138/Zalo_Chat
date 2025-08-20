# 🚀 Zalo OA Chat System

Hệ thống quản lý và chat realtime với Zalo Official Account, được phát triển bởi **AI Pencil**.

## ✨ Tính năng

### 🔗 Kết nối OA
- Kết nối với Zalo Official Account qua OAuth 2.0 + PKCE
- Quản lý nhiều OA cùng lúc
- Lưu trữ token tự động

### 💬 Chat Realtime
- Nhận tin nhắn realtime qua Webhook
- Hỗ trợ đầy đủ các loại tin nhắn:
  - ✍️ Tin nhắn văn bản
  - 📷 Hình ảnh
  - 🎵 Voice message
  - 😄 Sticker
  - 🎬 GIF
  - 🔗 Link
  - 📍 Vị trí
  - 🎉 Follow/Unfollow

### 🎯 Giao diện
- Dashboard quản lý OA
- Chat interface giống Messenger/Zalo
- Notification tin nhắn mới
- Responsive design

### 🤖 Auto Reply
- Phản hồi tự động cho các lệnh cơ bản
- Customizable chatbot logic

## 🛠️ Cài đặt

### 1. Clone project
```bash
git clone <repository-url>
cd Zalo_Chat
```

### 2. Cài đặt dependencies
```bash
npm install
```

### 3. Cấu hình môi trường
Tạo file `.env`:
```env
# Zalo App Credentials
ZALO_APP_ID=your_app_id
ZALO_APP_SECRET=your_app_secret
ZALO_REDIRECT_URI=your_redirect_uri

# Server Configuration
PORT=3000
DATABASE_URL=postgresql://user:password@host:port/database
```

### 4. Thiết lập Database
Tạo các bảng cần thiết:
```sql
CREATE TABLE zalo_oas (
    oa_id VARCHAR(255) PRIMARY KEY,
    status VARCHAR(50) DEFAULT 'verified',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE zalo_tokens (
    oa_id VARCHAR(255) PRIMARY KEY,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE webhook_events (
    id SERIAL PRIMARY KEY,
    oa_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    received_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 5. Khởi động server
```bash
node server.js
```

## 🎮 Sử dụng

### 1. Kết nối OA
1. Truy cập `http://localhost:3000`
2. Click "Kết nối với Zalo OA"
3. Đăng nhập và authorize app
4. Được chuyển hướng về Dashboard

### 2. Chat với khách hàng
1. Từ Dashboard, chọn OA muốn chat
2. Xem danh sách hội thoại bên trái
3. Click vào hội thoại để bắt đầu chat
4. Nhập tin nhắn và gửi

### 3. Theo dõi tin nhắn mới
- Tin nhắn mới sẽ hiện notification ở góc phải màn hình
- Danh sách hội thoại tự động cập nhật
- Chat realtime không cần refresh

## 🧪 Test Webhook

Để test webhook locally:
```bash
node test_webhook.js
```

Script này sẽ gửi các event mẫu để kiểm tra:
- Tin nhắn văn bản
- Follow OA
- Gửi hình ảnh
- Gửi sticker

## 📁 Cấu trúc Project

```
Zalo_Chat/
├── server.js          # Main server với Express + Socket.IO
├── zalo_api.js        # Tích hợp Zalo API
├── database.js        # Kết nối PostgreSQL
├── test_webhook.js    # Script test webhook
├── public/            # Frontend files
│   ├── index.html     # Landing page
│   ├── dashboard.html # Dashboard OA
│   ├── chat.html      # Chat interface
│   ├── dashboard.js   # Dashboard logic
│   ├── main.js        # Chat logic
│   └── style.css      # Styles
└── .env              # Environment variables
```

## 🔧 Cấu hình Zalo

### 1. Tạo Zalo App
1. Truy cập [Zalo Developers](https://developers.zalo.me/)
2. Tạo ứng dụng mới
3. Lấy App ID và App Secret

### 2. Cấu hình Webhook
- Webhook URL: `https://yourdomain.com/zalo/webhook`
- Đăng ký các event cần thiết

### 3. Cấu hình OAuth
- Redirect URI: `https://yourdomain.com/oauth/zalo/callback`
- Enable PKCE

## 🚀 Deploy

### Deploy lên VPS
1. Upload code lên server
2. Cài đặt Node.js và PostgreSQL
3. Cấu hình Nginx reverse proxy
4. Setup SSL certificate
5. Cấu hình domain cho webhook

### Environment Variables Production
```env
NODE_ENV=production
ZALO_REDIRECT_URI=https://yourdomain.com/oauth/zalo/callback
```

## 🤝 Đóng góp

1. Fork project
2. Tạo feature branch
3. Commit changes
4. Push và tạo Pull Request

## 📞 Hỗ trợ

- **Email**: support@aipencil.com
- **Website**: https://aipencil.name.vn
- **Documentation**: [Zalo OA API Docs](https://developers.zalo.me/docs)

## 📝 License

MIT License - xem file LICENSE để biết thêm chi tiết.

---

**Phát triển bởi AI Pencil** 🎯
