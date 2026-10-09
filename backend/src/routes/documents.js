﻿import { Router } from 'express';
import { authMiddleware, sessionKeyMiddleware, requireRole } from '../middleware/auth.js';
import {
  createDocument,
  getDocumentById,
  formatDocument,
  saveDraft,
  getDraft,
  submitDocument,
  getVersions,
  saveCommentDraft,
  submitComment,
  updateAccessibility,
  listDocumentsByUser,
  listAccessibleDocuments,
  listDocumentsByDate,
  deleteDocument,
  searchDocuments,
} from '../services/documentService.js';

const NOW = "TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";
const router = Router();
router.use(authMiddleware, sessionKeyMiddleware);

/** List documents by user (own accessible or any for SUPER_ADMIN) */
router.get('/by-user/:userName', async (req, res) => {
  const { userName } = req.params;
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const month = parseInt(req.query.month, 10) || new Date().getMonth() + 1;

  if (req.userRole === 'NORMAL_USER' && userName !== req.user.user_name) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const docs = (req.userRole === 'SUPER_ADMIN')
    ? await listDocumentsByUser(userName, year, month)
    : await listAccessibleDocuments(userName, year, month);

  const formatted = [];
  for (const d of docs) {
    formatted.push(await formatDocument(d, req.userRole, req.userMasterKey, req.user.user_name));
  }
  res.json({ documents: formatted, year, month });
});

/** List documents by date (SUPER_ADMIN) */
router.get('/by-date/:date', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { date } = req.params;
  const page = parseInt(req.query.page, 10) || 1;
  const pageSize = parseInt(req.query.pageSize, 10) || 20;
  const { docs, total } = await listDocumentsByDate(date, page, pageSize);
  const formatted = [];
  for (const d of docs) {
    formatted.push(await formatDocument(d, 'SUPER_ADMIN', null, req.user.user_name));
  }
  res.json({ documents: formatted, total, page, pageSize });
});

/** SYS_ADMIN search — must be before /:id */
router.get('/admin/search', requireRole('SYS_ADMIN'), async (req, res) => {
  const { userName, date } = req.query;
  const docs = await searchDocuments(userName, date);
  const formatted = [];
  for (const d of docs) {
    formatted.push(await formatDocument(d, 'SYS_ADMIN', null, null));
  }
  res.json({ documents: formatted });
});

/** Get single document */
router.get('/:id', async (req, res) => {
  const doc = await getDocumentById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Not found' });

  if (req.userRole === 'NORMAL_USER' && doc.user_name !== req.user.user_name) {
    if (doc.accessibility !== 'Open') {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  res.json(await formatDocument(doc, req.userRole, req.userMasterKey, req.user.user_name));
});

/** Create document (NORMAL_USER only) */
router.post('/', requireRole('NORMAL_USER'), async (req, res) => {
  const { title, content, date } = req.body;
  if (!req.sessionPassword) {
    return res.status(400).json({ error: 'Session key required' });
  }
  const id = await createDocument({
    title: title || '无标题',
    content: content || '',
    date: date || new Date().toISOString().slice(0, 10),
    userName: req.user.user_name,
    password: req.sessionPassword,
    passwordSalt: req.user.password_salt,
  });
  res.json({ id });
});

/** Update title/date */
router.patch('/:id/meta', requireRole('NORMAL_USER'), async (req, res) => {
  const doc = await getDocumentById(req.params.id);
  if (!doc || doc.user_name !== req.user.user_name) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const { title, date } = req.body;
  const db = (await import('../db/index.js')).default;
  await db.prepare(`UPDATE documents SET title = ?, date = ?, updated_at = ${NOW} WHERE id = ?`)
    .run(title ?? doc.title, date ?? doc.date, doc.id);
  res.json({ success: true });
});

/** Draft save - saves all Document fields, submitted = 0 */
router.post('/:id/draft', requireRole('NORMAL_USER'), async (req, res) => {
  const { title, date, content, accessibility } = req.body;
  const ok = await saveDraft(
    req.params.id,
    { title, date, content, accessibility },
    req.user.user_name,
    req.sessionPassword,
    req.user.password_salt
  );
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  res.json({ success: true });
});

router.get('/:id/draft', requireRole('NORMAL_USER'), async (req, res) => {
  const draft = await getDraft(req.params.id, req.user.user_name, req.sessionPassword, req.user.password_salt);
  res.json({ draft });
});

/** Submit document */
router.post('/:id/submit', requireRole('NORMAL_USER'), async (req, res) => {
  const { title, content, date, accessibility } = req.body;
  const ok = await submitDocument(
    req.params.id,
    { title, content, date, accessibility },
    req.user.user_name,
    req.sessionPassword,
    req.user.password_salt
  );
  if (!ok) return res.status(403).json({ error: 'Forbidden' });
  res.json({ success: true });
});

/** History versions */
router.get('/:id/versions', requireRole('NORMAL_USER'), async (req, res) => {
  const versions = await getVersions(req.params.id, req.user.user_name, req.sessionPassword, req.user.password_salt);
  res.json({ versions });
});

/** SUPER_ADMIN: save comment draft (not visible to normal user) */
router.post('/:id/comment/draft', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { comment } = req.body;
  const ok = await saveCommentDraft(req.params.id, comment);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

/** SUPER_ADMIN: submit comment (visible to normal user) */
router.post('/:id/comment/submit', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { comment } = req.body;
  const ok = await submitComment(req.params.id, comment);
  if (!ok) return res.status(404).json({ error: 'Not found' });
  res.json({ success: true });
});

/** SUPER_ADMIN: set document accessibility (approve/reject open request) */
router.post('/:id/accessibility', requireRole('SUPER_ADMIN'), async (req, res) => {
  const { accessibility } = req.body;
  const ok = await updateAccessibility(req.params.id, accessibility);
  if (!ok) return res.status(400).json({ error: 'Invalid accessibility value' });
  res.json({ success: true });
});

router.delete('/:id', async (req, res) => {
  if (req.userRole === 'SYS_ADMIN') {
    await deleteDocument(req.params.id);
    return res.json({ success: true });
  }
  if (req.userRole === 'NORMAL_USER') {
    const doc = await getDocumentById(req.params.id);
    if (!doc || doc.user_name !== req.user.user_name) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await deleteDocument(req.params.id);
    return res.json({ success: true });
  }
  res.status(403).json({ error: 'Forbidden' });
});

export default router;