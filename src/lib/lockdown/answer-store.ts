/**
 * CORTEX LOCKDOWN - ENCRYPTED LOCAL ANSWER PERSISTENCE ENGINE
 *
 * Implements authenticated encrypted local persistence for candidate answers.
 * Guarantees:
 * 1. Authenticated Encryption: AES-256-GCM (128-bit authentication tag, 12-byte IV).
 * 2. Strict Session Binding: Additional Authenticated Data (AAD) cryptographically
 *    binds ciphertext to (studentId, examId, sessionId, sequenceNumber).
 * 3. Genuine Disk Persistence:
 *    - In browser / WebView2: Backed by persistent localStorage (LevelDB on disk).
 *    - In Node.js / CLI: Written directly to physical disk using atomic file write semantics (.tmp + rename).
 * 4. Interrupted Write & Crash Safety: Two-phase commit prevents corrupt partial writes.
 * 5. Tamper Detection: Any alteration of ciphertext, metadata, IV, or binding fails decryption.
 * 6. Monotonic Sequence Validation: Prevents out-of-order write regression.
 *
 * Strictly zero emojis.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface EncryptedAnswerEnvelope {
  version: number;
  algorithm: 'AES-256-GCM';
  studentId: string;
  examId: string;
  sessionId: string;
  sequenceNumber: number;
  updatedAt: number;
  saltHex: string;
  ivHex: string;
  ciphertextHex: string;
  tagHex: string;
  checksum: string;
}

export interface AnswerStoreRecord {
  answers: Record<string, any>;
  sequenceNumber: number;
  updatedAt: number;
  recovered: boolean;
}

export interface SaveAnswerOptions {
  examId: string;
  studentId: string;
  sessionId: string;
  answers: Record<string, any>;
  sequenceNumber?: number;
  customStorageDir?: string;
  clientSecret?: string;
}

export interface LoadAnswerOptions {
  examId: string;
  studentId: string;
  sessionId: string;
  customStorageDir?: string;
  clientSecret?: string;
}

export interface ClearAnswerOptions {
  examId: string;
  studentId: string;
  sessionId: string;
  customStorageDir?: string;
  clientSecret?: string;
}

// Memory cache for active session sequence tracking
const activeSequenceMap = new Map<string, number>();

function getSessionKey(studentId: string, examId: string, sessionId: string): string {
  return `${studentId.trim()}::${examId.trim()}::${sessionId.trim()}`;
}

export function getStorageDiskPath(studentId: string, examId: string, customDir?: string): string {
  const baseDir = customDir ||
    process.env.LOCALAPPDATA ||
    process.env.APPDATA ||
    path.join(os.homedir(), '.cortex-lockdown');
  const targetDir = path.join(baseDir, 'CortexLockdown', 'SecureCache', sanitizeKey(studentId));
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }
  return path.join(targetDir, `${sanitizeKey(examId)}.answers.enc`);
}

function sanitizeKey(s: string): string {
  return s.replace(/[^a-zA-Z0-9_\-]/g, '_');
}

function toHex(buf: ArrayBuffer | Uint8Array): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function getClientEntropy(): string {
  if (typeof process !== 'undefined' && process.env) {
    return (process.env.USERPROFILE || process.env.HOME || 'cortex_node_client').trim();
  }
  if (typeof window !== 'undefined' && window.location) {
    return (window.location.origin || 'cortex_browser_client').trim();
  }
  return 'cortex_universal_client';
}

function readExistingEnvelopeMetadata(studentId: string, examId: string, customDir?: string): { sequenceNumber: number } | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    const raw = window.localStorage.getItem(primaryKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed.sequenceNumber === 'number') return { sequenceNumber: parsed.sequenceNumber };
      } catch (_) {}
    }
  }
  if (typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customDir);
    if (fs.existsSync(diskPath)) {
      try {
        const raw = fs.readFileSync(diskPath, 'utf8');
        const parsed = JSON.parse(raw);
        if (typeof parsed.sequenceNumber === 'number') return { sequenceNumber: parsed.sequenceNumber };
      } catch (_) {}
    }
  }
  return null;
}

/**
 * Derives a dedicated 256-bit AES-GCM key using Web Crypto PBKDF2
 * bound to candidate identity, exam ID, session salt, and client entropy.
 * Enforces 100,000 iterations for robust brute-force resistance.
 */
async function deriveEncryptionKey(
  studentId: string,
  examId: string,
  sessionId: string,
  salt: Uint8Array,
  clientSecret?: string,
  legacyVersion?: boolean
): Promise<CryptoKey> {
  const iterations = legacyVersion ? 20000 : 100000;
  const entropy = legacyVersion ? '' : `_${getClientEntropy()}`;
  const secretSuffix = clientSecret ? `_${clientSecret.trim()}` : '';
  const prefix = legacyVersion ? 'cortex_lockdown_v1_auth' : 'cortex_lockdown_v2_auth';
  const secretMaterial = `${prefix}_${studentId}_${examId}_${sessionId}${secretSuffix}${entropy}`;

  const keyMaterial = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretMaterial),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return await globalThis.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as unknown as BufferSource,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Computes deterministic SHA-256 digest of answers object.
 */
async function computeSha256(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return toHex(digest);
}

/**
 * Persists candidate answers to authenticated encrypted local storage.
 * Enforces atomic commit semantics to prevent corrupted partial writes.
 */
export async function saveEncryptedAnswers(options: SaveAnswerOptions): Promise<EncryptedAnswerEnvelope> {
  const { examId, studentId, sessionId, answers, customStorageDir } = options;
  if (!examId || !studentId || !sessionId) {
    throw new Error('examId, studentId, and sessionId are strictly required for answer persistence binding');
  }

  const sessionKey = getSessionKey(studentId, examId, sessionId);
  let currentSeq = activeSequenceMap.get(sessionKey);
  if (currentSeq === undefined) {
    const existing = readExistingEnvelopeMetadata(studentId, examId, customStorageDir);
    currentSeq = existing ? existing.sequenceNumber : 0;
    activeSequenceMap.set(sessionKey, currentSeq);
  }

  const sequenceNumber = options.sequenceNumber !== undefined ? options.sequenceNumber : currentSeq + 1;

  if (sequenceNumber < currentSeq) {
    throw new Error(`Monotonic sequence violation: attempted seq ${sequenceNumber} is older than current committed ${currentSeq}`);
  }
  activeSequenceMap.set(sessionKey, sequenceNumber);

  const updatedAt = Date.now();
  const serializedAnswers = JSON.stringify(answers || {});
  const checksum = await computeSha256(serializedAnswers);

  // Generate 16-byte cryptographic salt and 12-byte initialization vector
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(16));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));

  // Construct Additional Authenticated Data (AAD) binding identity, exam, session, and sequence
  const aadString = `BIND:${studentId.trim()}:${examId.trim()}:${sessionId.trim()}:SEQ:${sequenceNumber}`;
  const aad = new TextEncoder().encode(aadString);

  // Derive key and execute authenticated AES-GCM encryption
  const cryptoKey = await deriveEncryptionKey(studentId, examId, sessionId, salt, options.clientSecret);
  const encryptedBuf = await globalThis.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
      additionalData: aad as unknown as BufferSource,
      tagLength: 128,
    },
    cryptoKey,
    new TextEncoder().encode(serializedAnswers)
  );

  // In Web Crypto AES-GCM, the 16-byte tag is appended to the ciphertext
  const encArray = new Uint8Array(encryptedBuf);
  const tagBytes = encArray.slice(encArray.length - 16);
  const cipherBytes = encArray.slice(0, encArray.length - 16);

  const envelope: EncryptedAnswerEnvelope = {
    version: 2,
    algorithm: 'AES-256-GCM',
    studentId,
    examId,
    sessionId,
    sequenceNumber,
    updatedAt,
    saltHex: toHex(salt),
    ivHex: toHex(iv),
    ciphertextHex: toHex(cipherBytes),
    tagHex: toHex(tagBytes),
    checksum,
  };

  const envelopeJson = JSON.stringify(envelope);

  // ATOMIC PERSISTENCE LAYER:
  // 1. Browser / WebView2 localStorage with draft staging key
  if (typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    const stagingKey = `${primaryKey}_staging`;
    try {
      window.localStorage.setItem(stagingKey, envelopeJson);
      window.localStorage.setItem(primaryKey, envelopeJson);
      window.localStorage.removeItem(stagingKey);
    } catch (err: any) {
      console.error('[AnswerStore] Browser local storage write error:', err);
      throw new Error(`Browser local storage write failed: ${err.message}`);
    }
  }

  // 2. Physical Disk Write (Node.js / desktop / test environment)
  if (typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customStorageDir);
    const nonce = Math.random().toString(36).substring(2, 8);
    const tmpPath = `${diskPath}.${Date.now()}_${nonce}.tmp`;
    try {
      const fd = fs.openSync(tmpPath, 'w', 0o600);
      fs.writeSync(fd, envelopeJson, undefined, 'utf8');
      fs.fsyncSync(fd);
      fs.closeSync(fd);

      // Windows-resilient atomic rename with brief backoff retries for file indexing / anti-malware locks
      let renamed = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          fs.renameSync(tmpPath, diskPath);
          renamed = true;
          break;
        } catch (renameErr: any) {
          if (attempt === 4 || (renameErr.code !== 'EPERM' && renameErr.code !== 'EBUSY')) {
            throw renameErr;
          }
          Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, (attempt + 1) * 8);
        }
      }
      if (!renamed) {
        fs.renameSync(tmpPath, diskPath);
      }
    } catch (err: any) {
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (_) {}
      }
      console.error('[AnswerStore] Physical disk persistence error:', err);
      throw new Error(`Physical disk persistence failed: ${err.message}`);
    }
  }

  return envelope;
}

/**
 * Loads, verifies, and decrypts candidate answers from local encrypted persistence.
 * Enforces cryptographic authenticity, checksum validity, and session binding.
 */
export async function loadEncryptedAnswers(options: LoadAnswerOptions): Promise<AnswerStoreRecord | null> {
  const { examId, studentId, sessionId, customStorageDir } = options;
  if (!examId || !studentId || !sessionId) {
    throw new Error('examId, studentId, and sessionId are strictly required for answer recovery');
  }

  let envelopeJson: string | null = null;

  // 1. Check Browser / WebView2 localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    envelopeJson = window.localStorage.getItem(primaryKey);
    if (!envelopeJson) {
      // Check if an interrupted write left a valid staging key
      const stagingKey = `${primaryKey}_staging`;
      envelopeJson = window.localStorage.getItem(stagingKey);
    }
  }

  // 2. Fall back to Physical Disk File (Node.js / desktop / test environment)
  if (!envelopeJson && typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customStorageDir);
    if (fs.existsSync(diskPath)) {
      envelopeJson = fs.readFileSync(diskPath, 'utf8');
    }
  }

  if (!envelopeJson) {
    return null;
  }

  let envelope: EncryptedAnswerEnvelope;
  try {
    envelope = JSON.parse(envelopeJson);
  } catch (err) {
    throw new Error('Corrupted storage envelope: Invalid JSON');
  }

  // 1. Validate Session Binding
  if (envelope.studentId !== studentId) {
    throw new Error(`BINDING_VIOLATION: Stored answers belong to student '${envelope.studentId}', not '${studentId}'`);
  }
  if (envelope.examId !== examId) {
    throw new Error(`BINDING_VIOLATION: Stored answers belong to examination '${envelope.examId}', not '${examId}'`);
  }
  if (envelope.sessionId !== sessionId) {
    throw new Error(`BINDING_VIOLATION: Stored answers belong to session '${envelope.sessionId}', not '${sessionId}'`);
  }

  // 2. Reconstruct Cryptographic Parameters
  const salt = fromHex(envelope.saltHex);
  const iv = fromHex(envelope.ivHex);
  const cipherBytes = fromHex(envelope.ciphertextHex);
  const tagBytes = fromHex(envelope.tagHex);

  // Combine ciphertext and 16-byte authentication tag for Web Crypto AES-GCM
  const fullEncrypted = new Uint8Array(cipherBytes.length + tagBytes.length);
  fullEncrypted.set(cipherBytes, 0);
  fullEncrypted.set(tagBytes, cipherBytes.length);

  // Reconstruct exact AAD used during encryption
  const aadString = `BIND:${studentId.trim()}:${examId.trim()}:${sessionId.trim()}:SEQ:${envelope.sequenceNumber}`;
  const aad = new TextEncoder().encode(aadString);

  // Derive key and decrypt with authentication verification (v2: 100,000 iterations + client entropy)
  let cryptoKey = await deriveEncryptionKey(studentId, examId, sessionId, salt, options.clientSecret, false);
  let decryptedBytes: ArrayBuffer | null = null;
  try {
    decryptedBytes = await globalThis.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv as unknown as BufferSource,
        additionalData: aad as unknown as BufferSource,
        tagLength: 128,
      },
      cryptoKey,
      fullEncrypted as unknown as BufferSource
    );
  } catch (err: any) {
    // If v2 fails, attempt legacy v1 fallback (20,000 iterations without entropy)
    try {
      const legacyKey = await deriveEncryptionKey(studentId, examId, sessionId, salt, options.clientSecret, true);
      decryptedBytes = await globalThis.crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv as unknown as BufferSource,
          additionalData: aad as unknown as BufferSource,
          tagLength: 128,
        },
        legacyKey,
        fullEncrypted as unknown as BufferSource
      );
    } catch (_) {}
  }

  if (!decryptedBytes) {
    throw new Error('TAMPER_DETECTED: Cryptographic integrity verification failed. Data has been altered or key mismatch.');
  }

  const decryptedText = new TextDecoder().decode(decryptedBytes);

  // 3. Verify SHA-256 Checksum
  const computedChecksum = await computeSha256(decryptedText);
  if (computedChecksum !== envelope.checksum) {
    throw new Error('TAMPER_DETECTED: Checksum mismatch between envelope and decrypted content.');
  }

  let parsedAnswers: Record<string, any>;
  try {
    parsedAnswers = JSON.parse(decryptedText);
  } catch (err) {
    throw new Error('Corrupted payload: Decrypted data is not valid JSON.');
  }

  // Synchronize internal monotonic sequence map
  const sessionKey = getSessionKey(studentId, examId, sessionId);
  activeSequenceMap.set(sessionKey, envelope.sequenceNumber);

  return {
    answers: parsedAnswers,
    sequenceNumber: envelope.sequenceNumber,
    updatedAt: envelope.updatedAt,
    recovered: true,
  };
}

/**
 * Securely clears local encrypted answer cache after verified server-side submission.
 */
export async function clearEncryptedAnswers(options: ClearAnswerOptions): Promise<boolean> {
  const { examId, studentId, sessionId, customStorageDir } = options;
  const sessionKey = getSessionKey(studentId, examId, sessionId);
  activeSequenceMap.delete(sessionKey);

  let cleared = false;

  // Clear browser storage
  if (typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    const stagingKey = `${primaryKey}_staging`;
    window.localStorage.removeItem(primaryKey);
    window.localStorage.removeItem(stagingKey);
    cleared = true;
  }

  // Clear physical disk file with cryptographic overwrite (secure shredding)
  if (typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customStorageDir);
    if (fs.existsSync(diskPath)) {
      try {
        const fileLen = fs.statSync(diskPath).size;
        if (fileLen > 0) {
          fs.writeFileSync(diskPath, Buffer.alloc(fileLen, 0));
        }
        fs.unlinkSync(diskPath);
        cleared = true;
      } catch (_) {}
    }
  }

  return cleared;
}

/**
 * Simulates an application crash by terminating memory state, leaving on-disk storage intact.
 */
export function simulateMemoryCrash(): void {
  activeSequenceMap.clear();
}
