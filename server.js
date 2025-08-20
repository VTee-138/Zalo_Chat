import express from "express";
import http from 'http'; // <-- Thêm module http
import { Server } from 'socket.io'; // <-- Thêm module socket.io
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { sendTextMessage } from './zalo_api.js';
import db from './database.js';
import session from 'express-session'; 

const app = express();
const server = http.createServer(app); // <-- Tạo một http server từ app express
const io = new Server(server); // <-- Khởi tạo socket.io server

const pkceStore = new Map();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

const { ZALO_APP_ID, ZALO_APP_SECRET, ZALO_REDIRECT_URI, PORT = 3000 } = process.env;

if (!ZALO_APP_ID || !ZALO_APP_SECRET || !ZALO_REDIRECT_URI) {
  console.error("Vui lòng cung cấp đủ các biến môi trường trong file .env");
  process.exit(1);
}

app.use(session({
    secret: 'mot-chuoi-bi-mat-dai-ngoang-khong-doan-duoc', // Thay bằng một chuỗi bí mật của riêng bạn
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true } // Đặt là `true` nếu bạn chạy trên HTTPS thật
}));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));
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
    await db.query(upsertOaQuery, [oa_id]);
    await db.query(upsertTokenQuery, [oa_id, access_token, refresh_token, expiresAt]);
    console.log(`✅ Lưu thông tin thành công cho OA ID: ${oa_id}`);
    if (!req.session.connectedOAs) {
        req.session.connectedOAs = {};
    }

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

    req.session.connectedOAs[oa_id] = { name: `Official Account ${oa_id}`, avatar: '...' };
    res.redirect('/dashboard');
  
  } catch (error) {
    console.error("Lỗi khi lấy và lưu token:", error.response?.data || error.message);
    res.status(500).send("Đã có lỗi xảy ra phía máy chủ khi xử lý token.");
  }
});


// 3. Route xử lý Webhook từ Zalo (Giữ nguyên, không thay đổi)
app.post("/zalo/webhook", async (req, res) => {
  res.status(200).send("OK");
  try {
    const event = req.body;
    const { event_name, oa_id, sender } = event;
    console.log(`🔔 Nhận được webhook event: ${event_name} từ OA ${oa_id}`);
    const insertEventQuery = `INSERT INTO webhook_events (oa_id, event_type, payload) VALUES ($1, $2, $3);`;
    await db.query(insertEventQuery, [oa_id, event_name, event]);
    if (event_name === 'user_send_text') {
      const receivedText = event.message.text.toLowerCase().trim();
      const userId = sender.id;
      if (receivedText === "xin chào") {
        await sendTextMessage(oa_id, userId, "Chào bạn, tôi là bot của AI Pencil. Tôi có thể giúp gì cho bạn?");
      }
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
                payload->'sender'->>'displayName' as display_name,
                payload->'message'->>'text' as last_message,
                received_at
            FROM webhook_events
            WHERE oa_id = $1 AND event_type = 'user_send_text'
            ORDER BY user_id, received_at DESC;
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
app.get('/chat/:oaId', (req, res) => {
    // TODO: Kiểm tra xem người dùng có quyền truy cập oaId này không
    res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});
// Khởi động server
app.listen(PORT, '127.0.0.1', () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});