/**
 * Document CRUD with encryption — DEK per document, dual-wrapped for user + admin.
 * Migrated from SQLite (sync) to PostgreSQL (async).
 * Encryption functions are now async (Web Crypto API).
 */
import db from '../db/index.js';
import {
  generateDEK,
  encryptDEK,
  decryptDEK,
  encryptAES,
  decryptAES,
  deriveUserMasterKey,
  getAdminMasterKey,
} from '../crypto/encryption.js';
import { getAdminProfileOverride } from './userService.js';

const MAX_VERSIONS = 3;
const NOW = "TO_CHAR(NOW() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')";

/** Create new document with fresh DEK */
export async function createDocument({ title, content, date, userName, password, passwordSalt }) {
  const dek = generateDEK();
  const userKey = deriveUserMasterKey(password, passwordSalt);
  const adminKey = getAdminMasterKey();

  const dekUser = await encryptDEK(dek, userKey);
  const dekAdmin = await encryptDEK(dek, adminKey);
  const contentEnc = await encryptAES(content || '', dek);

  const result = await db.prepare(`
    INSERT INTO documents (
      title, date, user_name,
      content_ciphertext, content_iv, content_auth_tag,
      dek_user_ciphertext, dek_user_iv, dek_user_auth_tag,
      dek_admin_ciphertext, dek_admin_iv, dek_admin_auth_tag
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id
  `).run(
    title, date, userName,
    contentEnc.ciphertext, contentEnc.iv, contentEnc.authTag,
    dekUser.ciphertext, dekUser.iv, dekUser.authTag,
    dekAdmin.ciphertext, dekAdmin.iv, dekAdmin.authTag
  );

  return result.lastInsertRowid;
}

/** Get DEK for document based on role */
async function getDEK(doc, role, userMasterKey) {
  if (role === 'SUPER_ADMIN') {
    try {
      const adminKey = getAdminMasterKey();
      return await decryptDEK(doc.dek_admin_ciphertext, doc.dek_admin_iv, doc.dek_admin_auth_tag, adminKey);
    } catch {
      return null;
    }
  }
  if (role === 'NORMAL_USER' && userMasterKey) {
    try {
      return await decryptDEK(doc.dek_user_ciphertext, doc.dek_user_iv, doc.dek_user_auth_tag, userMasterKey);
    } catch {
      return null;
    }
  }
  return null;
}

/** Get admin DEK for Open documents */
async function getAdminDEK(doc) {
  try {
    const adminKey = getAdminMasterKey();
    return await decryptDEK(doc.dek_admin_ciphertext, doc.dek_admin_iv, doc.dek_admin_auth_tag, adminKey);
  } catch {
    return null;
  }
}

/** Decrypt field if DEK available */
async function decryptField(ciphertext, iv, authTag, dek) {
  if (!ciphertext || !dek) return null;
  try {
    return await decryptAES(ciphertext, iv, authTag, dek);
  } catch {
    return null;
  }
}

/** Format document for API response based on role */
export async function formatDocument(doc, role, userMasterKey, requestUserName) {
  const isOwner = doc.user_name === requestUserName;
  const isOpen = doc.accessibility === 'Open';

  let dek = await getDEK(doc, role, userMasterKey);

  if ((!dek || (!isOwner && isOpen)) && (role === 'NORMAL_USER' || role === 'SUPER_ADMIN')) {
    const adminDek = await getAdminDEK(doc);
    if (adminDek) dek = adminDek;
  }

  const effectiveDek = dek;

  const canDecryptContent = effectiveDek && (role === 'SUPER_ADMIN' || (role === 'NORMAL_USER' && (isOwner || isOpen)));
  const canDecryptComment =
    effectiveDek &&
    doc.comment_ciphertext &&
    (role === 'SUPER_ADMIN' || (role === 'NORMAL_USER' && doc.comment_submitted && (isOwner || isOpen)));

  const base = {
    id: doc.id,
    title: doc.title,
    date: doc.date,
    user_name: doc.user_name,
    has_comment: !!doc.comment_ciphertext && !!doc.comment_submitted,
    submitted: !!doc.submitted,
    accessibility: doc.accessibility || 'Private',
    created_at: doc.created_at,
    updated_at: doc.updated_at,
  };

  if (role === 'SUPER_ADMIN') {
    const override = await getAdminProfileOverride(doc.user_name);
    base.familyName = override?.familyName || '';
    base.givenName = override?.givenName || '';
  }

  if (role === 'SYS_ADMIN') {
    return { ...base, content: null, comment: null };
  }

  return {
    ...base,
    content: canDecryptContent
      ? await decryptField(doc.content_ciphertext, doc.content_iv, doc.content_auth_tag, effectiveDek)
      : null,
    comment: canDecryptComment
      ? await decryptField(doc.comment_ciphertext, doc.comment_iv, doc.comment_auth_tag, effectiveDek)
      : null,
  };
}

export async function getDocumentById(id) {
  return db.prepare('SELECT * FROM documents WHERE id = ?').get(id);
}

export async function updateDocumentContent(id, content, userName, password, passwordSalt) {
  const doc = await getDocumentById(id);
  if (!doc || doc.user_name !== userName) return false;

  const userKey = deriveUserMasterKey(password, passwordSalt);
  const dek = await decryptDEK(doc.dek_user_ciphertext, doc.dek_user_iv, doc.dek_user_auth_tag, userKey);
  const contentEnc = await encryptAES(content, dek);

  await db.prepare(`
    UPDATE documents SET
      content_ciphertext = ?, content_iv = ?, content_auth_tag = ?,
      updated_at = ${NOW}
    WHERE id = ?
  `).run(contentEnc.ciphertext, contentEnc.iv, contentEnc.authTag, id);

  return true;
}

export async function saveDraft(id, { title, date, content, accessibility }, userName, password, passwordSalt) {
  const doc = await getDocumentById(id);
  if (!doc || doc.user_name !== userName) return false;

  const userKey = deriveUserMasterKey(password, passwordSalt);
  const dek = await decryptDEK(doc.dek_user_ciphertext, doc.dek_user_iv, doc.dek_user_auth_tag, userKey);
  const draftEnc = await encryptAES(content, dek);

  await db.prepare(`
    UPDATE documents SET
      title = ?,
      date = ?,
      draft_ciphertext = ?, draft_iv = ?, draft_auth_tag = ?,
      draft_updated_at = ${NOW},
      submitted = 0,
      accessibility = ?
    WHERE id = ?
  `).run(title, date, draftEnc.ciphertext, draftEnc.iv, draftEnc.authTag, accessibility || 'Private', id);

  return true;
}

export async function getDraft(id, userName, password, passwordSalt) {
  const doc = await getDocumentById(id);
  if (!doc || doc.user_name !== userName || !doc.draft_ciphertext) return null;

  const userKey = deriveUserMasterKey(password, passwordSalt);
  const dek = await decryptDEK(doc.dek_user_ciphertext, doc.dek_user_iv, doc.dek_user_auth_tag, userKey);
  return await decryptAES(doc.draft_ciphertext, doc.draft_iv, doc.draft_auth_tag, dek);
}

/** Submit content and rotate versions (max 3) */
export async function submitDocument(id, { title, content, date, accessibility }, userName, password, passwordSalt) {
  const doc = await getDocumentById(id);
  if (!doc || doc.user_name !== userName) return false;

  const userKey = deriveUserMasterKey(password, passwordSalt);
  const dek = await decryptDEK(doc.dek_user_ciphertext, doc.dek_user_iv, doc.dek_user_auth_tag, userKey);
  const contentEnc = await encryptAES(content, dek);

  if (doc.content_ciphertext) {
    const versions = await db.prepare(
      'SELECT version_number FROM document_versions WHERE document_id = ? ORDER BY version_number DESC'
    ).all(id);

    if (versions.length >= MAX_VERSIONS) {
      const toDelete = versions[MAX_VERSIONS - 1];
      await db.prepare('DELETE FROM document_versions WHERE document_id = ? AND version_number = ?')
        .run(id, toDelete.version_number);
    }

    const nextVersion = versions.length > 0 ? versions[0].version_number + 1 : 1;
    await db.prepare(`
      INSERT INTO document_versions (document_id, version_number, content_ciphertext, content_iv, content_auth_tag)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, nextVersion, doc.content_ciphertext, doc.content_iv, doc.content_auth_tag);
  }

  await db.prepare(`
    UPDATE documents SET
      title = ?, date = ?,
      content_ciphertext = ?, content_iv = ?, content_auth_tag = ?,
      draft_ciphertext = NULL, draft_iv = NULL, draft_auth_tag = NULL,
      submitted = 1,
      accessibility = ?,
      updated_at = ${NOW}
    WHERE id = ?
  `).run(title, date, contentEnc.ciphertext, contentEnc.iv, contentEnc.authTag, accessibility || 'Private', id);

  const allVersions = await db.prepare(
    'SELECT id FROM document_versions WHERE document_id = ? ORDER BY version_number DESC'
  ).all(id);
  if (allVersions.length > MAX_VERSIONS) {
    for (let i = MAX_VERSIONS; i < allVersions.length; i++) {
      await db.prepare('DELETE FROM document_versions WHERE id = ?').run(allVersions[i].id);
    }
  }

  return true;
}

export async function getVersions(id, userName, password, passwordSalt) {
  const doc = await getDocumentById(id);
  if (!doc || doc.user_name !== userName) return [];

  const userKey = deriveUserMasterKey(password, passwordSalt);
  const dek = await decryptDEK(doc.dek_user_ciphertext, doc.dek_user_iv, doc.dek_user_auth_tag, userKey);

  const rows = await db.prepare(
    'SELECT * FROM document_versions WHERE document_id = ? ORDER BY version_number DESC LIMIT 3'
  ).all(id);

  const versions = [];
  for (const v of rows) {
    versions.push({
      version_number: v.version_number,
      content: await decryptAES(v.content_ciphertext, v.content_iv, v.content_auth_tag, dek),
      created_at: v.created_at,
    });
  }
  return versions;
}

/** SUPER_ADMIN: save comment draft (not visible to normal user yet) */
export async function saveCommentDraft(documentId, comment) {
  const doc = await getDocumentById(documentId);
  if (!doc) return false;

  const adminKey = getAdminMasterKey();
  const dek = await decryptDEK(doc.dek_admin_ciphertext, doc.dek_admin_iv, doc.dek_admin_auth_tag, adminKey);
  const commentEnc = await encryptAES(comment || '', dek);

  await db.prepare(`
    UPDATE documents SET
      comment_ciphertext = ?, comment_iv = ?, comment_auth_tag = ?,
      comment_submitted = 0,
      updated_at = ${NOW}
    WHERE id = ?
  `).run(commentEnc.ciphertext, commentEnc.iv, commentEnc.authTag, documentId);

  return true;
}

/** SUPER_ADMIN: submit comment (visible to normal user) */
export async function submitComment(documentId, comment) {
  const doc = await getDocumentById(documentId);
  if (!doc) return false;

  const adminKey = getAdminMasterKey();
  const dek = await decryptDEK(doc.dek_admin_ciphertext, doc.dek_admin_iv, doc.dek_admin_auth_tag, adminKey);
  const commentEnc = await encryptAES(comment || '', dek);

  await db.prepare(`
    UPDATE documents SET
      comment_ciphertext = ?, comment_iv = ?, comment_auth_tag = ?,
      comment_submitted = 1,
      updated_at = ${NOW}
    WHERE id = ?
  `).run(commentEnc.ciphertext, commentEnc.iv, commentEnc.authTag, documentId);

  return true;
}

/** SUPER_ADMIN: update comment (legacy - kept for backward compatibility) */
export async function updateComment(documentId, comment) {
  return submitComment(documentId, comment);
}

/** SUPER_ADMIN: update document accessibility */
export async function updateAccessibility(documentId, accessibility) {
  const validValues = ['Private', 'Wait for open', 'Open'];
  if (!validValues.includes(accessibility)) return false;

  const doc = await getDocumentById(documentId);
  if (!doc) return false;

  await db.prepare(`
    UPDATE documents SET accessibility = ?, updated_at = ${NOW} WHERE id = ?
  `).run(accessibility, documentId);

  return true;
}

export async function listDocumentsByUser(userName, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  return db.prepare(`
    SELECT * FROM documents
    WHERE user_name = ? AND date >= ? AND date < ?
    ORDER BY date DESC
  `).all(userName, startDate, endDate);
}

/** List documents accessible to a user (own + Open from others) for NORMAL_USER */
export async function listAccessibleDocuments(userName, year, month) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endMonth = month === 12 ? 1 : month + 1;
  const endYear = month === 12 ? year + 1 : year;
  const endDate = `${endYear}-${String(endMonth).padStart(2, '0')}-01`;

  return db.prepare(`
    SELECT * FROM documents
    WHERE date >= ? AND date < ?
    AND (user_name = ? OR accessibility = 'Open')
    ORDER BY user_name = ? DESC, date DESC
  `).all(startDate, endDate, userName, userName);
}

export async function listDocumentsByDate(date, page = 1, pageSize = 20) {
  const offset = (page - 1) * pageSize;
  const docs = await db.prepare(`
    SELECT * FROM documents WHERE date = ?
    ORDER BY user_name ASC
    LIMIT ? OFFSET ?
  `).all(date, pageSize, offset);

  const totalRow = await db.prepare('SELECT COUNT(*) as c FROM documents WHERE date = ?').get(date);
  const total = totalRow ? totalRow.c : 0;
  return { docs, total, page, pageSize };
}

export async function deleteDocument(id) {
  await db.prepare('DELETE FROM document_versions WHERE document_id = ?').run(id);
  return db.prepare('DELETE FROM documents WHERE id = ?').run(id);
}

export async function searchDocuments(userName, date) {
  let sql = 'SELECT * FROM documents WHERE 1=1';
  const params = [];
  if (userName) { sql += ' AND user_name = ?'; params.push(userName); }
  if (date) { sql += ' AND date = ?'; params.push(date); }
  sql += ' ORDER BY date DESC';
  return db.prepare(sql).all(...params);
}
