import { decryptToken } from './tokenCrypto.js';

let _db = null;
let _passphrase = null;

/**
 * Initialise the token manager with a database handle and passphrase.
 * Must be called before {@link resolveTokenForOwner} can return DB tokens.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} passphrase - TOKEN_PASSPHRASE from env.
 */
export function init(db, passphrase) {
  _db = db;
  _passphrase = passphrase;
}

/** Returns the passphrase the manager was initialised with, or null. */
export function getPassphrase() {
  return _passphrase;
}

/** True when init() has been called with a non-null db and passphrase. */
export function isReady() {
  return Boolean(_db && _passphrase);
}

/**
 * Returns true if the tokens table contains at least one row — used by the
 * startup check to decide whether TOKEN_PASSPHRASE is required.
 *
 * @param {import('better-sqlite3').Database} db
 */
export function hasStoredTokens(db) {
  return (db.prepare('SELECT COUNT(*) AS n FROM tokens').get()?.n ?? 0) > 0;
}

/**
 * Resolves the best available plaintext token for `owner` from the tokens
 * table. Matching is case-insensitive. A token whose `owners` field is empty
 * covers any owner. Returns the first matching decryptable token, or null if
 * the manager is uninitialised or no match is found.
 *
 * @param {string} owner - GitHub login (user or org).
 * @returns {string|null} Decrypted token, or null.
 */
export function resolveTokenForOwner(owner) {
  if (!_db || !_passphrase) return null;
  const ownerLc = (owner || '').toLowerCase();
  const rows = _db.prepare('SELECT * FROM tokens ORDER BY id').all();
  for (const row of rows) {
    const owners = row.owners
      ? row.owners.split(',').map((o) => o.trim().toLowerCase()).filter(Boolean)
      : [];
    // Empty owners → wildcard (covers any owner).
    if (owners.length === 0 || owners.includes(ownerLc)) {
      try {
        return decryptToken(
          { encrypted: row.token_encrypted, iv: row.iv, authTag: row.auth_tag, salt: row.salt },
          _passphrase,
        );
      } catch {
        // Wrong passphrase or corrupt row — skip and try the next one.
      }
    }
  }
  return null;
}
