import express from 'express';
import db from '../db.js';
import { getPassphrase } from '../lib/tokenManager.js';
import { encryptToken } from '../lib/tokenCrypto.js';

const router = express.Router();

/** List all stored tokens — names and owners only, never plaintext values. */
router.get('/tokens', (_req, res) => {
  const tokens = db.prepare('SELECT id, name, owners, created_at FROM tokens ORDER BY id').all();
  res.json({ tokens });
});

/** Add a new token. Body: { name, token, owners? }. owners is a string or string[]. */
router.post('/tokens', (req, res) => {
  const { name, token, owners } = req.body ?? {};
  if (!name || typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' });
  }
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'token is required' });
  }
  const passphrase = getPassphrase();
  if (!passphrase) {
    return res.status(409).json({
      error: 'TOKEN_PASSPHRASE is not set; cannot store encrypted tokens',
    });
  }
  const ownersStr = Array.isArray(owners)
    ? owners.map((o) => String(o).trim()).filter(Boolean).join(',')
    : (typeof owners === 'string' ? owners.trim() : '');
  try {
    const { encrypted, iv, authTag, salt } = encryptToken(token.trim(), passphrase);
    const result = db
      .prepare(
        `INSERT INTO tokens (name, token_encrypted, iv, auth_tag, salt, owners, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
      )
      .run(name.trim(), encrypted, iv, authTag, salt, ownersStr);
    res.status(201).json({ id: result.lastInsertRowid, name: name.trim(), owners: ownersStr });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/** Update a stored token's name, owners, and/or token value. Body fields are all optional. */
router.put('/tokens/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid token id' });
  }
  const existing = db.prepare('SELECT id FROM tokens WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'token not found' });

  const { name, token, owners } = req.body ?? {};
  const updates = {};

  if (name != null) updates.name = String(name).trim();
  if (owners != null) {
    updates.owners = Array.isArray(owners)
      ? owners.map((o) => String(o).trim()).filter(Boolean).join(',')
      : String(owners).trim();
  }
  if (token != null) {
    const passphrase = getPassphrase();
    if (!passphrase) {
      return res.status(409).json({ error: 'TOKEN_PASSPHRASE is not set' });
    }
    const { encrypted, iv, authTag, salt } = encryptToken(String(token).trim(), passphrase);
    updates.token_encrypted = encrypted;
    updates.iv = iv;
    updates.auth_tag = authTag;
    updates.salt = salt;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'no fields to update' });
  }

  const setCols = Object.keys(updates).map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE tokens SET ${setCols} WHERE id = ?`).run(...Object.values(updates), id);
  res.json({ ok: true });
});

/** Delete a stored token by id. */
router.delete('/tokens/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'invalid token id' });
  }
  const result = db.prepare('DELETE FROM tokens WHERE id = ?').run(id);
  if (result.changes === 0) return res.status(404).json({ error: 'token not found' });
  res.json({ ok: true });
});

export default router;
