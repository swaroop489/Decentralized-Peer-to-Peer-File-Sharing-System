// utils/cryptoUtils.js

const subtle = window.crypto.subtle;
const cryptoObj = window.crypto; // for getRandomValues

// ---------- RSA ----------

export async function generateRSAKeyPair() {
  return subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key) {
  const spki = await subtle.exportKey("spki", key);
  return arrayBufferToBase64(spki);
}

export async function importPublicKey(base64Key) {
  const spki = base64ToArrayBuffer(base64Key);
  return subtle.importKey(
    "spki",
    spki,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}

export async function encryptAESKeyWithRSA(aesKey, rsaPublicKey) {
  const rawAES = await subtle.exportKey("raw", aesKey);
  return subtle.encrypt(
    { name: "RSA-OAEP" },
    rsaPublicKey,
    rawAES
  );
}

export async function decryptAESKeyWithRSA(encryptedAESKey, rsaPrivateKey) {
  const rawAES = await subtle.decrypt(
    { name: "RSA-OAEP" },
    rsaPrivateKey,
    encryptedAESKey
  );
  return subtle.importKey(
    "raw",
    rawAES,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

// ---------- AES ----------

export async function generateAESKey() {
  return subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function encryptChunkAES(aesKey, chunk) {
  const iv = new Uint8Array(12);
  cryptoObj.getRandomValues(iv); // ← only this
  const encrypted = await subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    chunk
  );
  return { encrypted, iv };
}

export async function decryptChunkAES(aesKey, encryptedChunk, iv) {
  return subtle.decrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encryptedChunk
  );
}

// ---------- Helpers ----------

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64) {
  const binary = window.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
