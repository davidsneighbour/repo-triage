import Database from "better-sqlite3";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { runMigrations } from "./lib/migrations.js";
import { encryptToken } from "./lib/tokenCrypto.js";
import {
  getPassphrase,
  hasStoredTokens,
  init,
  isReady,
  resolveTokenForOwner,
} from "./lib/tokenManager.js";

const PASSPHRASE = "manager-test-passphrase";

let db;

beforeEach(() => {
  db = new Database(":memory:");
  db.pragma("journal_mode = WAL");
  runMigrations(db);
  init(db, PASSPHRASE);
});

afterEach(() => {
  // Reset to uninitialised state so tests don't bleed into each other.
  init(null, null);
  db.close();
});

function insertToken(name, token, owners = "") {
  const { encrypted, iv, authTag, salt } = encryptToken(token, PASSPHRASE);
  return db
    .prepare(
      `INSERT INTO tokens (name, token_encrypted, iv, auth_tag, salt, owners, created_at)
       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    )
    .run(name, encrypted, iv, authTag, salt, owners).lastInsertRowid;
}

// ---- init / accessors -------------------------------------------------------

describe("init / getPassphrase / isReady", () => {
  it("isReady returns true after init with non-null values", () => {
    expect(isReady()).toBe(true);
  });

  it("isReady returns false when reset to null", () => {
    init(null, null);
    expect(isReady()).toBe(false);
  });

  it("getPassphrase returns the passphrase supplied to init", () => {
    expect(getPassphrase()).toBe(PASSPHRASE);
  });
});

// ---- hasStoredTokens -------------------------------------------------------

describe("hasStoredTokens", () => {
  it("returns false on an empty tokens table", () => {
    expect(hasStoredTokens(db)).toBe(false);
  });

  it("returns true after inserting a token", () => {
    insertToken("t", "ghp_abc", "owner1");
    expect(hasStoredTokens(db)).toBe(true);
  });
});

// ---- resolveTokenForOwner --------------------------------------------------

describe("resolveTokenForOwner", () => {
  it("returns null when not initialised", () => {
    init(null, null);
    expect(resolveTokenForOwner("any")).toBeNull();
  });

  it("returns null when the tokens table is empty", () => {
    expect(resolveTokenForOwner("any")).toBeNull();
  });

  it("returns the token for an exact owner match", () => {
    insertToken("t", "ghp_abc", "owner1");
    expect(resolveTokenForOwner("owner1")).toBe("ghp_abc");
  });

  it("is case-insensitive for owner matching", () => {
    insertToken("t", "ghp_abc", "MyOrg");
    expect(resolveTokenForOwner("myorg")).toBe("ghp_abc");
    expect(resolveTokenForOwner("MYORG")).toBe("ghp_abc");
  });

  it("matches any of multiple owners on the same token", () => {
    insertToken("t", "ghp_abc", "owner1,owner2,owner3");
    expect(resolveTokenForOwner("owner1")).toBe("ghp_abc");
    expect(resolveTokenForOwner("owner2")).toBe("ghp_abc");
    expect(resolveTokenForOwner("owner3")).toBe("ghp_abc");
  });

  it("treats whitespace in the owners field gracefully", () => {
    insertToken("t", "ghp_abc", " owner1 , owner2 ");
    expect(resolveTokenForOwner("owner1")).toBe("ghp_abc");
    expect(resolveTokenForOwner("owner2")).toBe("ghp_abc");
  });

  it("returns null for a non-matching owner", () => {
    insertToken("t", "ghp_abc", "owner1");
    expect(resolveTokenForOwner("other")).toBeNull();
  });

  it("treats an empty owners string as a wildcard matching any owner", () => {
    insertToken("wildcard", "ghp_xyz", "");
    expect(resolveTokenForOwner("anyone")).toBe("ghp_xyz");
    expect(resolveTokenForOwner("someone-else")).toBe("ghp_xyz");
  });

  it("returns the first matching token when multiple tokens match", () => {
    insertToken("first", "ghp_first", "shared-owner");
    insertToken("second", "ghp_second", "shared-owner");
    expect(resolveTokenForOwner("shared-owner")).toBe("ghp_first");
  });

  it("skips a token that cannot be decrypted (wrong passphrase stored) and falls through", () => {
    // Insert a token encrypted with a DIFFERENT passphrase — it cannot be
    // decrypted with PASSPHRASE and should be silently skipped.
    const bad = encryptToken("ghp_bad", "different-passphrase");
    db.prepare(
      `INSERT INTO tokens (name, token_encrypted, iv, auth_tag, salt, owners, created_at)
       VALUES ('bad', ?, ?, ?, ?, 'owner1', datetime('now'))`,
    ).run(bad.encrypted, bad.iv, bad.authTag, bad.salt);

    // Good token inserted second — should be returned instead.
    insertToken("good", "ghp_good", "owner1");
    expect(resolveTokenForOwner("owner1")).toBe("ghp_good");
  });
});
