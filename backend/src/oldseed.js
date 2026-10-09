/**
 * Seed database: 210 NORMAL_USERs, 1 SYS_ADMIN, 1 SUPER_ADMIN, sample documents.
 */
import 'dotenv/config';
import crypto from 'crypto';
import db from './db/index.js';
import { createUser } from './services/userService.js';
import { createDocument } from './services/documentService.js';

function randomPassword() {
  return crypto.randomBytes(8).toString('hex');
}

function randomDate(daysBack = 365) {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString().slice(0, 10);
}

console.log('Seeding 日记 database...');

// Clear existing data
db.exec(`
  DELETE FROM document_versions;
  DELETE FROM documents;
  DELETE FROM verification_codes;
  DELETE FROM captcha_sessions;
  DELETE FROM users;
`);

const sysPassword = 'sys123';//randomPassword();
const superPassword = 'master123';//randomPassword();

createUser({
  userName: 'sysadmin',
  email: 'sysadmin@riji.local',
  password: sysPassword,
  role: 'SYS_ADMIN',
  photo: '',
  address: 'System Admin Office',
});

createUser({
  userName: 'master',
  email: 'master@riji.local',
  password: superPassword,
  role: 'SUPER_ADMIN',
  photo: '',
  address: 'Super Admin Office',
});

const normalUsers = [];
for (let i = 1; i <= 210; i++) {
  const userName = `user${String(i).padStart(3, '0')}`;
  const password = 'user123';
  createUser({
    userName,
    email: `${userName}@riji.local`,
    password,
    role: 'NORMAL_USER',
    photo: '',
    address: `Address ${i}`,
  });
  normalUsers.push({ userName, password });

  // 1-3 documents per user
  const docCount = 1 + Math.floor(Math.random() * 3);
  for (let j = 0; j < docCount; j++) {
    createDocument({
      title: `${userName} 的日记 ${j + 1}`,
      content: `<p>这是 <b>${userName}</b> 的第 ${j + 1} 篇日记内容。</p>`,
      date: randomDate(180),
      userName,
      password,
      passwordSalt: db.prepare('SELECT password_salt FROM users WHERE user_name = ?').get(userName).password_salt,
    });
  }
}

console.log('\n========== 日记 Seed Complete ==========');
console.log('SYS_ADMIN:');
console.log('  user_name: sysadmin');
console.log(`  password:  ${sysPassword}`);
console.log('SUPER_ADMIN:');
console.log('  user_name: superadmin');
console.log(`  password:  ${superPassword}`);
console.log('NORMAL_USER (sample):');
console.log('  user_name: user001');
console.log('  password:  user123');
console.log('=========================================\n');

// Create test documents with different accessibility states
function createTestDocument(title, content, userName, password, accessibility, submitted = 1) {
  const passwordSalt = db.prepare('SELECT password_salt FROM users WHERE user_name = ?').get(userName).password_salt;
  const id = createDocument({ title, content, date: randomDate(30), userName, password, passwordSalt });

  if (accessibility || submitted !== 1) {
    db.prepare(`
      UPDATE documents SET accessibility = ?, submitted = ? WHERE id = ?
    `).run(accessibility || 'Private', submitted, id);
  }
  return id;
}

// Create "Wait for open" documents for testing accessibility approval
createTestDocument(
  '申请开放文档 A',
  '<p>这是一个申请开放的文档，等待超级管理员审批。</p>',
  'user001', 'user123', 'Wait for open'
);

createTestDocument(
  '申请开放文档 B',
  '<p>这是另一个申请开放的文档。</p>',
  'user002', 'user123', 'Wait for open'
);

// Create "Open" documents
createTestDocument(
  '已开放文档 X',
  '<p>这个文档已经开放，所有人可见。</p>',
  'user001', 'user123', 'Open'
);

// Create submitted=0 (draft) document
createTestDocument(
  '草稿文档',
  '<p>这是一个暂存中的草稿文档。</p>',
  'user001', 'user123', 'Private', 0
);

console.log('Created test documents for accessibility approval workflow:');
