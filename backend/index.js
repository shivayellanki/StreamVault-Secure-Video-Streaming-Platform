import 'dotenv/config';
import express from "express";
import cors from "cors";
import multer from "multer";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { exec } from "child_process";
import mysql from "mysql2/promise";
import bcrypt from "bcrypt";

const app = express();

const SECRET_KEY = process.env.JWT_SECRET || "streamvault_super_secret_2024";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "shivayellanki08@gmail.com";
const ADMIN_PASS = process.env.ADMIN_PASS || "admin1234";
const SALT_ROUNDS = 10;

// ─────────────────────────────────────────────────────────────
// Database — connection pool + initialisation
// ─────────────────────────────────────────────────────────────

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  multipleStatements: true,
};

let pool;

async function initDatabase() {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.query("CREATE DATABASE IF NOT EXISTS secure_streaming");
    await conn.end();

    pool = mysql.createPool({
      ...dbConfig,
      database: process.env.DB_NAME || "secure_streaming",
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    console.log("MySQL connected.");

    // ── Schema migration: drop old tables if they use the old username-based schema ──
    const [cols] = await pool.query(`
      SELECT COLUMN_NAME FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = 'secure_streaming' AND TABLE_NAME = 'users'
    `);
    const colNames = cols.map((c) => c.COLUMN_NAME);
    const isOldSchema = colNames.includes('username') || (!colNames.includes('email') && colNames.length > 0);

    if (isOldSchema) {
      console.log("Old schema detected — dropping tables and rebuilding...");
      await pool.query(`
        SET FOREIGN_KEY_CHECKS = 0;
        DROP TABLE IF EXISTS purchases;
        DROP TABLE IF EXISTS courses;
        DROP TABLE IF EXISTS users;
        SET FOREIGN_KEY_CHECKS = 1;
      `);
    }

    // ── Create tables ──────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            INT AUTO_INCREMENT PRIMARY KEY,
        email         VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role          ENUM('user','admin') NOT NULL DEFAULT 'user',
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS courses (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        lesson_id   VARCHAR(255) UNIQUE NOT NULL,
        title       VARCHAR(255) NOT NULL,
        description TEXT,
        price       DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS purchases (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_email   VARCHAR(255) NOT NULL,
        lesson_id    VARCHAR(255) NOT NULL,
        purchased_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_purchase (user_email, lesson_id),
        FOREIGN KEY (user_email) REFERENCES users(email)
      );
    `);

    // ── Seed admin ──────────────────────────────────────────────────
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [ADMIN_EMAIL]
    );
    if (existing.length === 0) {
      const hash = await bcrypt.hash(ADMIN_PASS, SALT_ROUNDS);
      await pool.query(
        "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'admin')",
        [ADMIN_EMAIL, hash]
      );
      console.log(`Admin seeded → ${ADMIN_EMAIL}`);
    }

    console.log("Database ready.");
  } catch (err) {
    console.error("Database init failed:", err);
    process.exit(1);
  }
}

await initDatabase();

// ─────────────────────────────────────────────────────────────
// Multer
// ─────────────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, "./uploads"),
  filename: (_, file, cb) =>
    cb(null, file.fieldname + "-" + uuidv4() + path.extname(file.originalname)),
});
const upload = multer({ storage });

// ─────────────────────────────────────────────────────────────
// Middleware
// ─────────────────────────────────────────────────────────────

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,
].filter(Boolean);
app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// JWT auth middleware
const authMiddleware = (req, res, next) => {
  if (req.method === "OPTIONS") return next();

  const token =
    req.cookies?.token || req.headers["authorization"]?.split(" ")[1];
  if (!token)
    return res.status(401).json({ message: "Unauthorized: no token" });

  try {
    req.user = jwt.verify(token, SECRET_KEY);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Admin-only middleware
const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== "admin")
    return res.status(403).json({ message: "Admin access required" });
  next();
};

// Ownership middleware — checks the user has purchased the course
const requireOwnership = async (req, res, next) => {
  let lessonId = req.params.lessonId;

  if (!lessonId && req.path.includes("/courses/")) {
    const parts = req.path.split("/");
    const idx = parts.indexOf("courses");
    if (idx !== -1 && parts.length > idx + 1) lessonId = parts[idx + 1];
  }

  if (!lessonId)
    return res.status(400).json({ message: "Bad request: no lesson ID" });

  if (req.user?.role === "admin") return next();

  try {
    const [rows] = await pool.query(
      "SELECT id FROM purchases WHERE user_email = ? AND lesson_id = ?",
      [req.user.email, lessonId]
    );
    if (rows.length > 0) return next();
    return res.status(403).json({ message: "Access denied: purchase this course first." });
  } catch (err) {
    console.error("Ownership check error:", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// Protect /uploads — must be logged in AND own the course
app.use("/uploads", authMiddleware, requireOwnership, express.static("uploads"));

// ─────────────────────────────────────────────────────────────
// Auth routes
// ─────────────────────────────────────────────────────────────

// Register
app.post("/register", async (req, res) => {
  const { email, password } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email))
    return res.status(400).json({ message: "Please enter a valid email address." });

  if (!password || password.length < 6)
    return res.status(400).json({ message: "Password must be at least 6 characters." });

  try {
    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ?",
      [email]
    );
    if (existing.length > 0)
      return res.status(409).json({ message: "An account with this email already exists." });

    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    await pool.query(
      "INSERT INTO users (email, password_hash, role) VALUES (?, ?, 'user')",
      [email, hash]
    );

    return res.status(201).json({ message: "Account created. You can now sign in." });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({ message: "Registration failed. Try again." });
  }
});

// Login
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password)
    return res.status(400).json({ message: "Email and password are required." });

  try {
    const [rows] = await pool.query(
      "SELECT * FROM users WHERE email = ?",
      [email]
    );

    if (rows.length === 0)
      return res.status(401).json({ message: "Invalid credentials." });

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match)
      return res.status(401).json({ message: "Invalid credentials." });

    const token = jwt.sign(
      { email: user.email, role: user.role },
      SECRET_KEY,
      { expiresIn: "24h" }
    );

    const isProd = process.env.NODE_ENV === "production";
    res.cookie("token", token, {
      httpOnly: false,
      secure: isProd,
      sameSite: isProd ? "none" : "lax",
    });
    return res.json({
      message: `Welcome back!`,
      token,
      email: user.email,
      role: user.role,
    });
  } catch (err) {
    console.error("Login error:", err);
    return res.status(500).json({ message: "Login failed. Try again." });
  }
});

// Logout
app.post("/logout", (req, res) => {
  res.clearCookie("token");
  return res.json({ message: "Signed out." });
});

// ─────────────────────────────────────────────────────────────
// Course routes
// ─────────────────────────────────────────────────────────────

// All courses (public — no auth needed to browse)
app.get("/api/courses", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT lesson_id, title, description, price, created_at FROM courses ORDER BY created_at DESC"
    );
    return res.json(rows);
  } catch (err) {
    console.error("Courses fetch error:", err);
    return res.status(500).json({ message: "Failed to load courses." });
  }
});

// My purchased courses (auth required)
app.get("/api/my-courses", authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT lesson_id FROM purchases WHERE user_email = ?",
      [req.user.email]
    );
    return res.json(rows.map((r) => r.lesson_id));
  } catch (err) {
    console.error("My-courses fetch error:", err);
    return res.status(500).json({ message: "Failed to load your courses." });
  }
});

// ─────────────────────────────────────────────────────────────
// Payment / purchase
// ─────────────────────────────────────────────────────────────

app.post("/api/checkout", authMiddleware, async (req, res) => {
  const { lessonId, cardNumber, expiry, cvv } = req.body;

  if (!lessonId)
    return res.status(400).json({ message: "Lesson ID is required." });

  // Validate card fields
  const cleanCard = (cardNumber || "").replace(/\s/g, "");
  if (!/^\d{16}$/.test(cleanCard))
    return res.status(400).json({ message: "Card number must be 16 digits." });

  if (!/^\d{2}\/\d{2}$/.test(expiry || ""))
    return res.status(400).json({ message: "Expiry must be MM/YY format." });

  if (!/^\d{3,4}$/.test(cvv || ""))
    return res.status(400).json({ message: "CVV must be 3 or 4 digits." });

  try {
    // Simulate payment processing delay
    await new Promise((resolve) => setTimeout(resolve, 1200));

    await pool.query(
      "INSERT IGNORE INTO purchases (user_email, lesson_id) VALUES (?, ?)",
      [req.user.email, lessonId]
    );

    return res.json({ message: "Payment successful! Course unlocked." });
  } catch (err) {
    console.error("Checkout error:", err);
    return res.status(500).json({ message: "Payment failed. Try again." });
  }
});

// Legacy purchase endpoint (kept for backward compat)
app.post("/api/purchase", authMiddleware, async (req, res) => {
  const { lessonId } = req.body;
  try {
    await pool.query(
      "INSERT IGNORE INTO purchases (user_email, lesson_id) VALUES (?, ?)",
      [req.user.email, lessonId]
    );
    return res.json({ message: `Course ${lessonId} purchased.` });
  } catch (err) {
    return res.status(500).json({ message: "Purchase failed." });
  }
});

// ─────────────────────────────────────────────────────────────
// Key delivery (protected)
// ─────────────────────────────────────────────────────────────

app.get("/api/keys/:lessonId", authMiddleware, requireOwnership, (req, res) => {
  const { lessonId } = req.params;
  const keyPath = `./uploads/courses/${lessonId}/key.key`;
  if (fs.existsSync(keyPath)) {
    return res.sendFile(path.resolve(keyPath));
  }
  return res.status(404).json({ message: "Key not found." });
});

// ─────────────────────────────────────────────────────────────
// Upload (admin only)
// ─────────────────────────────────────────────────────────────

app.post(
  "/upload",
  authMiddleware,
  adminMiddleware,
  upload.single("file"),
  async (req, res) => {
    const { title = "Untitled Course", description = "", price = "0" } = req.body;
    const lessonId = uuidv4();
    const videoPath = req.file.path;
    const outputPath = `./uploads/courses/${lessonId}`;
    const hlsPath = `${outputPath}/index.m3u8`;

    if (!fs.existsSync(outputPath))
      fs.mkdirSync(outputPath, { recursive: true });

    // AES-128 key
    const key = crypto.randomBytes(16);
    const keyPath = `${outputPath}/key.key`;
    const keyInfoPath = `${outputPath}/key.info`;
    const keyUrl = `/api/keys/${lessonId}`;

    fs.writeFileSync(keyPath, key);
    fs.writeFileSync(keyInfoPath, `${keyUrl}\n${keyPath}`);

    const ffmpegCmd = `ffmpeg -i ${videoPath} -codec:v libx264 -codec:a aac -hls_time 10 -hls_playlist_type vod -hls_key_info_file ${keyInfoPath} -hls_segment_filename "${outputPath}/segment%03d.ts" -start_number 0 ${hlsPath}`;

    exec(ffmpegCmd, async (error) => {
      if (error) {
        console.error("ffmpeg error:", error);
        return res.status(500).json({ message: "Video processing failed." });
      }

      try {
        await pool.query(
          "INSERT INTO courses (lesson_id, title, description, price) VALUES (?, ?, ?, ?)",
          [lessonId, title, description, parseFloat(price)]
        );
        console.log(`Course created: ${title} → ${lessonId}`);

        const baseUrl = process.env.BACKEND_URL || `http://localhost:8000`;
        return res.json({
          message: "Video processed and course created.",
          lessonId,
          videoUrl: `${baseUrl}/uploads/courses/${lessonId}/index.m3u8`,
        });
      } catch (dbErr) {
        console.error("Course DB insert error:", dbErr);
        return res.status(500).json({ message: "Video processed but failed to save course." });
      }
    });
  }
);

// ─────────────────────────────────────────────────────────────
// Health check
// ─────────────────────────────────────────────────────────────

app.get("/", (_, res) => res.json({ status: "ok", service: "StreamVault API" }));

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => console.log(`StreamVault API running on port ${PORT}`));
