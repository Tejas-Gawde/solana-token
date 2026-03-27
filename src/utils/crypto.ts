import CryptoJS from "crypto-js";
import { config } from "../config/index.ts";

const SECRET_KEY = config.encryption.key;
const IV = config.encryption.iv;

/**
 * Encrypts a private key string using AES-256 encryption
 */
export function encryptPrivateKey(privateKeyBase58: string): string {
  const key = CryptoJS.enc.Hex.parse(SECRET_KEY);
  const iv = CryptoJS.enc.Hex.parse(IV);

  const encrypted = CryptoJS.AES.encrypt(privateKeyBase58, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  return encrypted.toString();
}

/**
 * Decrypts an encrypted private key string
 */
export function decryptPrivateKey(encryptedKey: string): string {
  const key = CryptoJS.enc.Hex.parse(SECRET_KEY);
  const iv = CryptoJS.enc.Hex.parse(IV);

  const decrypted = CryptoJS.AES.decrypt(encryptedKey, key, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const result = decrypted.toString(CryptoJS.enc.Utf8);

  if (!result) {
    throw new Error(
      "Failed to decrypt private key. Check encryption credentials.",
    );
  }

  return result;
}
