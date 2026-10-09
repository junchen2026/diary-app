/**
 * Email verification — logs to console when SMTP not configured.
 */
import nodemailer from 'nodemailer';
import crypto from 'crypto';
import db from '../db/index.js';

function getTransporter() {
  if (!process.env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: false,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

export function generateCode() {
  return String(crypto.randomInt(100000, 999999));
}

export function canSendCode(email, type) {
  const recent = db.prepare(`
    SELECT created_at FROM verification_codes
    WHERE email = ? AND type = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(email, type);

  if (!recent) return true;
  const created = new Date(recent.created_at + 'Z').getTime();
  return Date.now() - created >= 60000;
}

export function saveCode(email, code, type) {
  const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO verification_codes (email, code, type, expires_at) VALUES (?, ?, ?, ?)
  `).run(email, code, type, expires);
}

export function verifyCode(email, code, type) {
  const row = db.prepare(`
    SELECT * FROM verification_codes
    WHERE email = ? AND code = ? AND type = ?
    ORDER BY created_at DESC LIMIT 1
  `).get(email, code, type);

  if (!row) return false;
  if (new Date(row.expires_at) < new Date()) return false;
  db.prepare('DELETE FROM verification_codes WHERE email = ? AND type = ?').run(email, type);
  return true;
}

export async function sendVerificationEmail(email, code, purpose) {
  const subject = purpose === 'register' ? '日记 - 注册验证码' : '日记 - 重置密码验证码';
  const body = `您的验证码是：${code}\n有效期10分钟。`;

  console.log(`[EMAIL] To: ${email} | ${subject} | Code: ${code}`);

  const transporter = getTransporter();
  if (transporter) {
    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'riji@localhost',
      to: email,
      subject,
      text: body,
    });
  }
}
