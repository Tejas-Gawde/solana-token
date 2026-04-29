"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptPrivateKey = encryptPrivateKey;
exports.decryptPrivateKey = decryptPrivateKey;
const crypto_js_1 = __importDefault(require("crypto-js"));
const index_ts_1 = require("../config/index.ts");
const SECRET_KEY = index_ts_1.config.encryption.key;
const IV = index_ts_1.config.encryption.iv;
/**
 * Encrypts a private key string using AES-256 encryption
 */
function encryptPrivateKey(privateKeyBase58) {
    const key = crypto_js_1.default.enc.Hex.parse(SECRET_KEY);
    const iv = crypto_js_1.default.enc.Hex.parse(IV);
    const encrypted = crypto_js_1.default.AES.encrypt(privateKeyBase58, key, {
        iv,
        mode: crypto_js_1.default.mode.CBC,
        padding: crypto_js_1.default.pad.Pkcs7,
    });
    return encrypted.toString();
}
/**
 * Decrypts an encrypted private key string
 */
function decryptPrivateKey(encryptedKey) {
    const key = crypto_js_1.default.enc.Hex.parse(SECRET_KEY);
    const iv = crypto_js_1.default.enc.Hex.parse(IV);
    const decrypted = crypto_js_1.default.AES.decrypt(encryptedKey, key, {
        iv,
        mode: crypto_js_1.default.mode.CBC,
        padding: crypto_js_1.default.pad.Pkcs7,
    });
    const result = decrypted.toString(crypto_js_1.default.enc.Utf8);
    if (!result) {
        throw new Error("Failed to decrypt private key. Check encryption credentials.");
    }
    return result;
}
