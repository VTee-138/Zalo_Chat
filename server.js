import express from "express";
import http from 'http'; // <-- Thêm module http
import { Server } from 'socket.io'; // <-- Thêm module socket.io
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendTextMessage, getValidAccessToken, crawlMessagesFromZalo } from './zalo_api.js';
import db from './database.js';
import session from 'express-session'; 

const app = express();
const server = http.createServer(app); // <-- Tạo một http server từ app express
const io = new Server(server); // <-- Khởi tạo socket.io server

const pkceStore = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

// Middleware security và CORS
if (NODE_ENV === 'production') {
    app.set('trust proxy', 1); // Trust first proxy for HTTPS
    app.use((req, res, next) => {
        res.header('X-Content-Type-Options', 'nosniff');
        res.header('X-Frame-Options', 'DENY');
        res.header('X-XSS-Protection', '1; mode=block');
        next();
    });
}

app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

const { ZALO_APP_ID, ZALO_APP_SECRET, ZALO_REDIRECT_URI, PORT = 3000, NODE_ENV = 'development' } = process.env;

if (!ZALO_APP_ID || !ZALO_APP_SECRET || !ZALO_REDIRECT_URI) {
  console.error("Vui lòng cung cấp đủ các biến môi trường trong file .env");
  process.exit(1);
}

// Cấu hình session dựa theo environment
const sessionConfig = {
    secret: NODE_ENV === 'production' ? process.env.SESSION_SECRET || 'prod-secret-key-change-me' : 'abbbc',
    resave: false,
    saveUninitialized: true,
    cookie: { 
        secure: NODE_ENV === 'production', // HTTPS trong production
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
};

app.use(session(sessionConfig));
// 1. Route để bắt đầu quá trình kết nối (ĐÃ NÂNG CẤP PKCE)
app.get("/connect/zalo", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");

  // --- PHẦN MỚI: Tạo code_verifier và code_challenge ---
  const codeVerifier = crypto.randomBytes(32).toString("hex");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  // Lưu codeVerifier lại để dùng ở bước callback
  pkceStore.set(state, codeVerifier);
  // --------------------------------------------------------

  const u = new URL("https://oauth.zaloapp.com/v4/oa/permission");
  u.searchParams.set("app_id", ZALO_APP_ID);
  u.searchParams.set("redirect_uri", ZALO_REDIRECT_URI);
  u.searchParams.set("state", state);
  
  // --- PHẦN MỚI: Thêm tham số PKCE vào URL ---
  u.searchParams.set("code_challenge", codeChallenge);
  u.searchParams.set("code_challenge_method", "S256");
  // ---------------------------------------------
  console.log("--- DEBUG URL ---");
  console.log("URL đang được sử dụng để chuyển hướng:", u.toString());
  console.log("-----------------");
  res.redirect(u.toString());
});

// 2. Route xử lý callback từ Zalo (ĐÃ NÂNG CẤP PKCE)
app.get("/oauth/zalo/callback", async (req, res) => {
  const { code, state, oa_id } = req.query;

  // --- PHẦN MỚI: Lấy và xóa code_verifier đã lưu ---
  const codeVerifier = pkceStore.get(state);
  if (!codeVerifier) {
    return res.status(400).send("Lỗi: state không hợp lệ hoặc đã hết hạn.");
  }
  pkceStore.delete(state); // Verifier chỉ dùng một lần
  // ----------------------------------------------------

  if (!code) {
    return res.status(400).send("Không tìm thấy mã `code` trong callback.");
  }

  try {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      app_id: ZALO_APP_ID,
      code: String(code),
      // --- PHẦN MỚI: Gửi code_verifier để Zalo xác thực ---
      code_verifier: codeVerifier,
      // --------------------------------------------------
    });

    const response = await axios.post(
      "https://oauth.zaloapp.com/v4/oa/access_token",
      form.toString(),
      { headers: {
          "content-type": "application/x-www-form-urlencoded",
          "secret_key": ZALO_APP_SECRET
      }}
    );

    const { access_token, refresh_token, expires_in } = response.data;
    
    // Logic lưu vào DB giữ nguyên
    console.log(`💾 Bắt đầu lưu thông tin cho OA ID: ${oa_id}`);
    const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000);
    const upsertOaQuery = `INSERT INTO zalo_oas (oa_id, status) VALUES ($1, 'verified') ON CONFLICT (oa_id) DO NOTHING;`;
    const upsertTokenQuery = `INSERT INTO zalo_tokens (oa_id, access_token, refresh_token, expires_at) VALUES ($1, $2, $3, $4) ON CONFLICT (oa_id) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, expires_at = EXCLUDED.expires_at;`;
    await db.query(upsertOaQuery, [oa_id]);
    await db.query(upsertTokenQuery, [oa_id, access_token, refresh_token, expiresAt]);
    console.log(`✅ Lưu thông tin thành công cho OA ID: ${oa_id}`);

    // Lưu thông tin OA vào session
    if (!req.session.connectedOAs) {
        req.session.connectedOAs = {};
    }
    req.session.connectedOAs[oa_id] = { name: `Official Account ${oa_id}`, avatar: '...' };
    
    res.redirect('/dashboard');
  
  } catch (error) {
    console.error("Lỗi khi lấy và lưu token:", error.response?.data || error.message);
    res.status(500).send("Đã có lỗi xảy ra phía máy chủ khi xử lý token.");
  }
});


// 3. Route xử lý Webhook từ Zalo - XỬ LÝ ĐẦY ĐỦ CÁC LOẠI TIN NHẮN
app.post("/zalo/webhook", async (req, res) => {
  res.status(200).send("OK");
  try {
    const event = req.body;
    const { event_name, oa_id, sender, message } = event;
    console.log(`🔔 Nhận được webhook event: ${event_name} từ OA ${oa_id}`, JSON.stringify(event, null, 2));
    
    // Lưu event vào database
    const insertEventQuery = `INSERT INTO webhook_events (oa_id, event_type, payload) VALUES ($1, $2, $3);`;
    await db.query(insertEventQuery, [oa_id, event_name, event]);
    
    // Broadcast event tới tất cả client đang kết nối với room cụ thể
    io.to(`oa_${oa_id}`).emit('zalo_event', event);
    
    // Xử lý các loại tin nhắn khác nhau
    if (event_name === 'user_send_text') {
      const receivedText = message?.text?.toLowerCase().trim();
      const userId = sender?.id;
      
      if (receivedText === "xin chào" || receivedText === "hello" || receivedText === "hi") {
        await sendTextMessage(oa_id, userId, "Xin chào! Tôi là chatbot của AI Pencil. Tôi có thể giúp gì cho bạn? 😊");
      } else if (receivedText === "help" || receivedText === "giúp đỡ") {
        await sendTextMessage(oa_id, userId, "Đây là các lệnh bạn có thể sử dụng:\n• 'xin chào' - Chào hỏi\n• 'help' - Xem trợ giúp\n• 'info' - Thông tin về dịch vụ");
      } else if (receivedText === "info" || receivedText === "thông tin") {
        await sendTextMessage(oa_id, userId, "🚀 AI Pencil - Nền tảng tự động hóa Zalo OA\n📧 Liên hệ: support@aipencil.com\n🌐 Website: https://aipencil.name.vn");
      }
    } else if (event_name === 'user_send_image') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "📷 Tôi đã nhận được hình ảnh của bạn. Cảm ơn bạn đã chia sẻ!");
    } else if (event_name === 'user_send_audio') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "🎵 Tôi đã nhận được tin nhắn voice của bạn. Hiện tại tôi chưa thể phản hồi voice, nhưng bạn có thể gửi tin nhắn text!");
    } else if (event_name === 'user_send_sticker') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "😄 Sticker rất đẹp! Cảm ơn bạn đã gửi.");
    } else if (event_name === 'user_send_gif') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "🎬 GIF thật thú vị! Cảm ơn bạn đã chia sẻ.");
    } else if (event_name === 'user_send_link') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "🔗 Tôi đã nhận được link từ bạn. Cảm ơn bạn!");
    } else if (event_name === 'user_send_location') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "📍 Cảm ơn bạn đã chia sẻ vị trí. Chúng tôi đã ghi nhận thông tin!");
    } else if (event_name === 'follow') {
      const userId = sender?.id;
      await sendTextMessage(oa_id, userId, "🎉 Chào mừng bạn đến với Official Account của AI Pencil!\n\nHãy gửi 'help' để xem các lệnh có thể sử dụng.");
    } else if (event_name === 'unfollow') {
      console.log(`👋 User ${sender?.id} đã unfollow OA ${oa_id}`);
    }
    
  } catch (error) {
    console.error("Lỗi khi xử lý webhook:", error);
  }
});

app.post("/api/send-message", async (req, res) => {
    const { oa_id, user_id, text } = req.body;
    if (!oa_id || !user_id || !text) {
        return res.status(400).json({ success: false, message: "Thiếu thông tin." });
    }
    const success = await sendTextMessage(oa_id, user_id, text);
    if (success) {
        res.json({ success: true, message: "Gửi tin nhắn thành công." });
    } else {
        res.status(500).json({ success: false, message: "Gửi tin nhắn thất bại." });
    }
});

io.on('connection', (socket) => {
  console.log('🟢 Một người dùng đã kết nối vào web');
  
  // Lắng nghe khi client join room của một OA cụ thể
  socket.on('join_oa_room', (oa_id) => {
    socket.join(`oa_${oa_id}`);
    console.log(`👤 Client đã join room cho OA: ${oa_id}`);
  });
  
  // Lắng nghe khi client rời room
  socket.on('leave_oa_room', (oa_id) => {
    socket.leave(`oa_${oa_id}`);
    console.log(`👋 Client đã rời room OA: ${oa_id}`);
  });
  
  socket.on('disconnect', () => {
    console.log('🔴 Người dùng đã ngắt kết nối');
  });
});

app.get("/api/conversations/:oa_id", async (req, res) => {
    const { oa_id } = req.params;
    try {
        // Query này dùng DISTINCT ON để lấy tin nhắn cuối cùng từ mỗi người dùng
        const query = `
            SELECT DISTINCT ON (payload->'sender'->>'id')
                payload->'sender'->>'id' as user_id,
                COALESCE(payload->'sender'->>'displayName', payload->'sender'->>'display_name') as display_name,
                payload->'message'->>'text' as last_message,
                received_at,
                event_type
            FROM webhook_events
            WHERE oa_id = $1 AND event_type LIKE 'user_send_%'
            ORDER BY payload->'sender'->>'id', received_at DESC;
        `;
        const result = await db.query(query, [oa_id]);
        res.json(result.rows);
    } catch (error) {
        console.error("Lỗi khi lấy danh sách hội thoại:", error);
        res.status(500).json([]);
    }
});

// API 2: Lấy lịch sử tin nhắn của một người dùng
app.get("/api/messages/:oa_id/:user_id", async (req, res) => {
    const { oa_id, user_id } = req.params;
    try {
        // Lấy tất cả sự kiện liên quan đến user này
        const query = `
            SELECT * FROM webhook_events
            WHERE oa_id = $1 
              AND (
                (event_type LIKE 'user_send_%' AND payload->'sender'->>'id' = $2)
                OR
                (event_type LIKE 'oa_send_%' AND payload->'recipient'->>'id' = $2)
              )
            ORDER BY received_at ASC;
        `;
        const result = await db.query(query, [oa_id, user_id]);
        res.json(result.rows);
    } catch (error) {
        console.error("Lỗi khi lấy lịch sử tin nhắn:", error);
        res.status(500).json([]);
    }
});

app.get('/dashboard', (req, res) => {
    // TODO: Kiểm tra nếu người dùng chưa kết nối OA nào, có thể điều hướng về trang chủ
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// API để lấy danh sách OA đã kết nối từ session
app.get('/api/get-connected-oas', (req, res) => {
    if (req.session.connectedOAs) {
        res.json(req.session.connectedOAs);
    } else {
        res.json({});
    }
});

// API để lấy thông tin chi tiết của user từ Zalo
app.get('/api/user-info/:oa_id/:user_id', async (req, res) => {
    const { oa_id, user_id } = req.params;
    try {
        // Lấy access token
        const accessToken = await getValidAccessToken(oa_id);
        if (!accessToken) {
            return res.status(400).json({ error: 'No valid access token' });
        }

        // Gọi API Zalo để lấy thông tin user
        const response = await axios.get(
            `https://openapi.zalo.me/v3.0/oa/user/detail?data={"user_id":"${user_id}"}`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
            }
        );

        if (response.data.error === 0) {
            res.json(response.data.data);
        } else {
            res.status(400).json({ error: response.data.message });
        }
    } catch (error) {
        console.error('Lỗi khi lấy thông tin user:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// API để crawl tin nhắn từ Zalo OA
app.post('/api/crawl-messages/:oa_id', async (req, res) => {
    const { oa_id } = req.params;
    const { limit = 20 } = req.body;
    
    try {
        console.log(`🚀 Bắt đầu crawl tin nhắn cho OA: ${oa_id}`);
        const success = await crawlMessagesFromZalo(oa_id, limit);
        
        if (success) {
            res.json({ 
                success: true, 
                message: `Đã crawl thành công tin nhắn cho OA ${oa_id}` 
            });
        } else {
            res.status(500).json({ 
                success: false, 
                message: 'Crawl tin nhắn thất bại' 
            });
        }
    } catch (error) {
        console.error('Lỗi khi crawl tin nhắn:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Lỗi server khi crawl tin nhắn' 
        });
    }
});

app.get('/chat/:oaId', (req, res) => {
    // TODO: Kiểm tra xem người dùng có quyền truy cập oaId này không
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});
// Khởi động server
const HOST = NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`🚀 Server đang chạy tại ${NODE_ENV === 'production' ? 'https://chatbot.aipencil.name.vn' : `http://localhost:${PORT}`}`);
  console.log(`📡 Environment: ${NODE_ENV}`);
  console.log(`🔗 Host: ${HOST}:${PORT}`);
});