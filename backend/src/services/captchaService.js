﻿/**
 * Math captcha — 扭曲图片在 frontend 生成，backend 存储答案。
 * Migrated from SQLite (sync) to PostgreSQL (async).
 */
import crypto from 'crypto';
import db from '../db/index.js';

export async function generateCaptcha() {
  const ops = [
    { sym: '+', fn: () => { const a = rand(1, 20); const b = rand(1, 20); return { a, b, answer: a + b }; } },
    { sym: '-', fn: () => { const a = rand(10, 30); const b = rand(1, a); return { a, b, answer: a - b }; } },
  ];
  const chosen = ops[Math.floor(Math.random() * ops.length)];
  const { a, b, answer } = chosen.fn();
  const op = chosen.sym;

  const id = crypto.randomUUID();
  await db.prepare('INSERT INTO captcha_sessions (id, answer) VALUES (?, ?)').run(id, answer);

  // Clean old captchas (>10 min)
  await db.exec("DELETE FROM captcha_sessions WHERE created_at < TO_CHAR(NOW() AT TIME ZONE 'UTC' - INTERVAL '10 minutes', 'YYYY-MM-DD HH24:MI:SS')");

  return { id, question: `${a} ${op} ${b} = ?` };
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function verifyCaptcha(id, userAnswer) {
  const row = await db.prepare('SELECT answer FROM captcha_sessions WHERE id = ?').get(id);
  if (!row) return false;
  await db.prepare('DELETE FROM captcha_sessions WHERE id = ?').run(id);
  return parseInt(userAnswer, 10) === row.answer;
}