// server.js
import express from "express";
import axios from "axios";
import crypto from "crypto";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// ===== PHẦN MỚI: IMPORT MODULE DATABASE =====
import db from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(express.static(path.join(__dirname, 'public')));

const { ZALO_APP_ID, ZALO_APP_SECRET, ZALO_REDIRECT_URI, PORT = 3000 } = process.env;

if (!ZALO_APP_ID || !ZALO_APP_SECRET || !ZALO_REDIRECT_URI) {
  console.error("Vui lòng cung cấp đủ các biến môi trường trong file .env");
  process.exit(1);
}

// 1. Route để bắt đầu quá trình kết nối (Không thay đổi)
app.get("/connect/zalo", (req, res) => {
  const state = crypto.randomBytes(16).toString("hex");
  const u = new URL("https://oauth.zaloapp.com/v4/oa/permission");
  u.searchParams.set("app_id", ZALO_APP_ID);
  u.searchParams.set("redirect_uri", ZALO_REDIRECT_URI);
  u.searchParams.set("state", state);
  res.redirect(u.toString());
});

// 2. Route xử lý callback từ Zalo - ===== NÂNG CẤP LỚN Ở ĐÂY =====
app.get("/oauth/zalo/callback", async (req, res) => {
  const { code, state, oa_id } = req.query;

  if (!code) {
    return res.status(400).send("Không tìm thấy mã `code` trong callback.");
  }

  try {
    const form = new URLSearchParams({
      grant_type: "authorization_code",
      app_id: ZALO_APP_ID,
      code: String(code),
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
    
    // ===== PHẦN MỚI: LƯU TOKEN VÀO DATABASE =====
    console.log(`💾 Bắt đầu lưu thông tin cho OA ID: ${oa_id}`);
    
    // Tính toán thời gian hết hạn
    const expiresAt = new Date(Date.now() + (expires_in - 300) * 1000); // Trừ 5 phút để refresh sớm

    // Lệnh SQL UPSERT: Nếu oa_id đã tồn tại thì UPDATE, chưa có thì INSERT
    const upsertOaQuery = `
      INSERT INTO zalo_oas (oa_id, status)
      VALUES ($1, 'verified')
      ON CONFLICT (oa_id) DO NOTHING;
    `;
    
    const upsertTokenQuery = `
      INSERT INTO zalo_tokens (oa_id, access_token, refresh_token, expires_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (oa_id) DO UPDATE SET
        access_token = EXCLUDED.access_token,
        refresh_token = EXCLUDED.refresh_token,
        expires_at = EXCLUDED.expires_at;
    `;

    // Thực thi các câu lệnh SQL
    await db.query(upsertOaQuery, [oa_id]);
    await db.query(upsertTokenQuery, [oa_id, access_token, refresh_token, expiresAt]);

    console.log(`✅ Lưu thông tin thành công cho OA ID: ${oa_id}`);
    // ===============================================

    res.send("<h1>Kết nối Zalo OA thành công!</h1><p>Dữ liệu đã được lưu vào hệ thống. Bạn có thể đóng cửa sổ này.</p>");
  
  } catch (error) {
    console.error("Lỗi khi lấy và lưu token:", error.response?.data || error.message);
    res.status(500).send("Đã có lỗi xảy ra phía máy chủ khi xử lý token.");
  }
});

// 3. Route xử lý Webhook từ Zalo - ===== NÂNG CẤP LỚN Ở ĐÂY =====
app.post("/zalo/webhook", async (req, res) => {
  // Trả về 200 OK ngay lập tức để không bị Zalo retry
  res.status(200).send("OK");
  
  // ===== PHẦN MỚI: LƯU SỰ KIỆN WEBHOOK VÀO DATABASE (xử lý bất đồng bộ) =====
  try {
    const event = req.body;
    const { event_name, oa_id } = event;

    console.log(` webhook event: ${event_name}`);

    const insertEventQuery = `
      INSERT INTO webhook_events (oa_id, event_type, payload)
      VALUES ($1, $2, $3);
    `;

    await db.query(insertEventQuery, [oa_id, event_name, event]);
    
  } catch (error) {
    // Ghi lại lỗi nhưng không ảnh hưởng đến response trả về cho Zalo
    console.error("Lỗi khi lưu sự kiện webhook:", error);
  }
  // =========================================================================
});

// Khởi động server
app.listen(PORT, () => {
  console.log(`Server đang chạy tại http://localhost:${PORT}`);
});