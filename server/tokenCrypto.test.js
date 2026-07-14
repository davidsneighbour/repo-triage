import { describe, expect, it } from "vitest";
import { decryptToken, deriveKey, encryptToken } from "./lib/tokenCrypto.js";

const PASSPHRASE = "test-passphrase-for-unit-tests";
const TOKEN = "ghp_SomeSecretToken1234567890abcdef";

describe("deriveKey", () => {
  it("produces a 32-byte Buffer", () => {
    const salt = Buffer.from("0123456789abcdef", "utf8");
    const key = deriveKey(PASSPHRASE, salt);
    expect(key).toBeInstanceOf(Buffer);
    expect(key.length).toBe(32);
  });

  it("produces the same key for the same passphrase + salt", () => {
    const salt = Buffer.from("fixed-salt", "utf8");
    expect(deriveKey(PASSPHRASE, salt).toString("hex")).toBe(
      deriveKey(PASSPHRASE, salt).toString("hex"),
    );
  });

  it("produces a different key for a different passphrase", () => {
    const salt = Buffer.from("fixed-salt", "utf8");
    expect(deriveKey(PASSPHRASE, salt).toString("hex")).not.toBe(
      deriveKey("other-passphrase", salt).toString("hex"),
    );
  });
});

describe("encryptToken", () => {
  it("returns an object with the four required base64 fields", () => {
    const result = encryptToken(TOKEN, PASSPHRASE);
    for (const key of ["encrypted", "iv", "authTag", "salt"]) {
      expect(result, `field ${key} missing`).toHaveProperty(key);
      expect(typeof result[key]).toBe("string");
      expect(result[key].length).toBeGreaterThan(0);
    }
  });

  it("never stores the plaintext token in any field", () => {
    const result = encryptToken(TOKEN, PASSPHRASE);
    for (const [k, v] of Object.entries(result)) {
      expect(v, `field ${k} should not contain the plaintext`).not.toContain(
        TOKEN,
      );
    }
  });

  it("produces different ciphertext on each call (random IV + salt)", () => {
    const a = encryptToken(TOKEN, PASSPHRASE);
    const b = encryptToken(TOKEN, PASSPHRASE);
    expect(a.encrypted).not.toBe(b.encrypted);
    expect(a.iv).not.toBe(b.iv);
    expect(a.salt).not.toBe(b.salt);
  });
});

describe("decryptToken", () => {
  it("round-trips the plaintext correctly", () => {
    const enc = encryptToken(TOKEN, PASSPHRASE);
    expect(decryptToken(enc, PASSPHRASE)).toBe(TOKEN);
  });

  it("round-trips an empty string", () => {
    const enc = encryptToken("", PASSPHRASE);
    expect(decryptToken(enc, PASSPHRASE)).toBe("");
  });

  it("round-trips a token containing special characters", () => {
    const special = "ghp_abc+123/xyz==\nline2";
    const enc = encryptToken(special, PASSPHRASE);
    expect(decryptToken(enc, PASSPHRASE)).toBe(special);
  });

  it("throws when the passphrase is wrong (GCM auth tag mismatch)", () => {
    const enc = encryptToken(TOKEN, PASSPHRASE);
    expect(() => decryptToken(enc, "wrong-passphrase")).toThrow();
  });

  it("throws when the ciphertext is tampered with", () => {
    const enc = encryptToken(TOKEN, PASSPHRASE);
    // Flip a bit in the ciphertext.
    const buf = Buffer.from(enc.encrypted, "base64");
    buf[0] ^= 0xff;
    const tampered = { ...enc, encrypted: buf.toString("base64") };
    expect(() => decryptToken(tampered, PASSPHRASE)).toThrow();
  });
});
