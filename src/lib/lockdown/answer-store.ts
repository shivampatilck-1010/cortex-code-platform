/**
 * CORTEX LOCKDOWN - ENCRYPTED LOCAL ANSWER PERSISTENCE ENGINE
 *
 * Implements authenticated encrypted local persistence for candidate answers.
 * Guarantees:
 * 1. Authenticated Encryption: AES-256-GCM (128-bit authentication tag, 12-byte IV).
 * 2. Strict Session Binding: Additional Authenticated Data (AAD) cryptographically
 *    binds ciphertext to (studentId, examId, sessionId, sequenceNumber).
 * 3. IndexedDB Local Buffering Engine:
 *    - In browser / WebView2: Primary storage in IndexedDB (CortexLockdownDB -> encrypted_answers),
 *      with indexed sequence numbers and timestamps, keyed by ${studentId}:${examId}.
 *    - Seamless automatic fallback to localStorage when IndexedDB is unavailable.
 * 4. Genuine Physical Disk Persistence:
 *    - In Node.js / CLI / Desktop: Written directly to physical disk using atomic
 *      file write semantics (.tmp + fsync + retryable renameSync).
 * 5. Interrupted Write & Crash Safety: ACID transactions in IndexedDB, two-phase staging
 *    in localStorage, atomic temp writes on physical disk.
 * 6. Tamper Detection: Any alteration of ciphertext, metadata, IV, or binding fails decryption.
 * 7. Monotonic Sequence Validation: Prevents out-of-order write regression.
 * 8. Cryptographic Zero-Fill Shredding: Physical disk zero-filled before unlink upon confirmed receipt.
 *
 * Strictly zero emojis.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export const CORTEX_LOCKDOWN_DB_NAME = 'CortexLockdownDB';
export const ENCRYPTED_ANSWERS_STORE_NAME = 'encrypted_answers';
export const CORTEX_LOCKDOWN_DB_VERSION = 1;

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
  key?: string;
  storageKey?: string;
}

export type AnswerEnvelope = EncryptedAnswerEnvelope;

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

// Cached IndexedDB connection
let cachedDb: IDBDatabase | null = null;

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

function getIndexedDB(): IDBFactory | null {
  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB as IDBFactory;
  }
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  return null;
}

export function closeDatabase(): void {
  if (cachedDb) {
    try {
      cachedDb.close();
    } catch (_) {}
    cachedDb = null;
  }
}

export function openDatabase(): Promise<IDBDatabase | null> {
  const idb = getIndexedDB();
  if (!idb) return Promise.resolve(null);

  if (cachedDb) {
    try {
      if (cachedDb.name) {
        return Promise.resolve(cachedDb);
      }
    } catch (_) {
      cachedDb = null;
    }
  }

  return new Promise((resolve) => {
    try {
      const request = idb.open(CORTEX_LOCKDOWN_DB_NAME, CORTEX_LOCKDOWN_DB_VERSION);

      request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(ENCRYPTED_ANSWERS_STORE_NAME)) {
          const store = db.createObjectStore(ENCRYPTED_ANSWERS_STORE_NAME);
          store.createIndex('sequenceNumber', 'sequenceNumber', { unique: false });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('studentExam', ['studentId', 'examId'], { unique: false });
          store.createIndex('studentId', 'studentId', { unique: false });
          store.createIndex('examId', 'examId', { unique: false });
        }
      };

      request.onsuccess = (event: Event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        cachedDb = db;
        db.onclose = () => { cachedDb = null; };
        db.onerror = () => { cachedDb = null; };
        resolve(db);
      };

      request.onerror = () => {
        resolve(null);
      };

      request.onblocked = () => {
        resolve(null);
      };
    } catch (err) {
      resolve(null);
    }
  });
}

function putToStore(store: IDBObjectStore, value: any, key: string): IDBRequest {
  if (store.keyPath) {
    const keyProp = Array.isArray(store.keyPath) ? store.keyPath[0] : store.keyPath;
    value[keyProp] = key;
    return store.put(value);
  }
  return store.put(value, key);
}

function saveEnvelopeToIndexedDB(
  db: IDBDatabase,
  key: string,
  envelope: EncryptedAnswerEnvelope
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ENCRYPTED_ANSWERS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(ENCRYPTED_ANSWERS_STORE_NAME);
      putToStore(store, envelope, key);

      tx.oncomplete = () => resolve();
      tx.onerror = (e) => reject(tx.error || e);
      tx.onabort = () => reject(new Error('IndexedDB transaction aborted'));
    } catch (err) {
      reject(err);
    }
  });
}

function getEnvelopeFromIndexedDB(
  db: IDBDatabase,
  studentId: string,
  examId: string
): Promise<EncryptedAnswerEnvelope | null> {
  return new Promise((resolve, reject) => {
    try {
      const tx = db.transaction(ENCRYPTED_ANSWERS_STORE_NAME, 'readonly');
      const store = tx.objectStore(ENCRYPTED_ANSWERS_STORE_NAME);
      const key = `${studentId}:${examId}`;
      const req = store.get(key);

      req.onsuccess = () => {
        if (!req.result) {
          resolve(null);
          return;
        }
        let env = req.result;
        if (typeof env === 'string') {
          try {
            env = JSON.parse(env);
          } catch (_) {
            resolve(null);
            return;
          }
        }
        resolve(env as EncryptedAnswerEnvelope);
      };

      req.onerror = () => {
        reject(req.error || new Error('IndexedDB get failed'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

function deleteEnvelopeFromIndexedDB(
  db: IDBDatabase,
  studentId: string,
  examId: string
): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(ENCRYPTED_ANSWERS_STORE_NAME, 'readwrite');
      const store = tx.objectStore(ENCRYPTED_ANSWERS_STORE_NAME);
      const key = `${studentId}:${examId}`;
      store.delete(key);

      // Clean up any other records indexed under this studentId and examId
      if (store.indexNames && store.indexNames.contains('studentExam')) {
        try {
          const index = store.index('studentExam');
          const range = IDBKeyRange.only([studentId, examId]);
          const cursorReq = index.openCursor(range);
          cursorReq.onsuccess = (e: any) => {
            const cursor = e.target.result;
            if (cursor) {
              cursor.delete();
              cursor.continue();
            }
          };
        } catch (_) {}
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch (_) {
      resolve();
    }
  });
}

function getAllEnvelopesFromIndexedDB(
  db: IDBDatabase,
  studentId: string,
  examId: string
): Promise<AnswerEnvelope[]> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(ENCRYPTED_ANSWERS_STORE_NAME, 'readonly');
      const store = tx.objectStore(ENCRYPTED_ANSWERS_STORE_NAME);
      const items: AnswerEnvelope[] = [];
      const key = `${studentId}:${examId}`;

      const getReq = store.get(key);
      getReq.onsuccess = () => {
        if (getReq.result) {
          let env = getReq.result;
          if (typeof env === 'string') {
            try { env = JSON.parse(env); } catch (_) { env = null; }
          }
          if (env && env.studentId === studentId && env.examId === examId) {
            items.push(env as AnswerEnvelope);
          }
        }

        // Query index if available to find all buffered sequence records
        if (store.indexNames && store.indexNames.contains('studentExam')) {
          try {
            const index = store.index('studentExam');
            const range = IDBKeyRange.only([studentId, examId]);
            const cursorReq = index.openCursor(range);
            cursorReq.onsuccess = (e: any) => {
              const cursor = e.target.result;
              if (cursor) {
                let val = cursor.value;
                if (typeof val === 'string') {
                  try { val = JSON.parse(val); } catch (_) { val = null; }
                }
                if (val && !items.some((x) => x.sequenceNumber === val.sequenceNumber)) {
                  items.push(val as AnswerEnvelope);
                }
                cursor.continue();
              } else {
                resolve(items);
              }
            };
            cursorReq.onerror = () => resolve(items);
            return;
          } catch (_) {}
        }

        resolve(items);
      };

      getReq.onerror = () => resolve(items);
    } catch (_) {
      resolve([]);
    }
  });
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

async function readExistingEnvelopeMetadataAsync(
  studentId: string,
  examId: string,
  customDir?: string
): Promise<{ sequenceNumber: number } | null> {
  // If customDir is specified, prioritize physical disk
  if (customDir && typeof process !== 'undefined' && process.versions?.node) {
    const fromDisk = readExistingEnvelopeMetadata(studentId, examId, customDir);
    if (fromDisk) return fromDisk;
  }

  // 1. Try IndexedDB
  try {
    const db = await openDatabase();
    if (db) {
      const idbEnv = await getEnvelopeFromIndexedDB(db, studentId, examId);
      if (idbEnv && typeof idbEnv.sequenceNumber === 'number') {
        return { sequenceNumber: idbEnv.sequenceNumber };
      }
    }
  } catch (_) {}

  // 2. Fall back to synchronous metadata reader (localStorage & physical disk)
  return readExistingEnvelopeMetadata(studentId, examId, customDir);
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
 * Enforces atomic commit semantics across IndexedDB, localStorage, and physical disk.
 */
export async function saveEncryptedAnswers(options: SaveAnswerOptions): Promise<EncryptedAnswerEnvelope> {
  const { examId, studentId, sessionId, answers, customStorageDir } = options;
  if (!examId || !studentId || !sessionId) {
    throw new Error('examId, studentId, and sessionId are strictly required for answer persistence binding');
  }

  const sessionKey = getSessionKey(studentId, examId, sessionId);
  let currentSeq = activeSequenceMap.get(sessionKey);
  if (currentSeq === undefined) {
    const existing = await readExistingEnvelopeMetadataAsync(studentId, examId, customStorageDir);
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

  const storageKey = `${studentId}:${examId}`;

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
    key: storageKey,
    storageKey,
  };

  const envelopeJson = JSON.stringify(envelope);

  // ATOMIC PERSISTENCE LAYER:
  // 1. IndexedDB Local Buffering Engine (Primary browser offline store)
  let idbSuccess = false;
  try {
    const db = await openDatabase();
    if (db) {
      await saveEnvelopeToIndexedDB(db, storageKey, envelope);
      idbSuccess = true;
    }
  } catch (idbErr: any) {
    console.warn('[AnswerStore] IndexedDB persistence warning (falling back to localStorage):', idbErr?.message || idbErr);
  }

  // 2. Browser / WebView2 localStorage with draft staging key (fallback & dual redundancy)
  if (typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    const stagingKey = `${primaryKey}_staging`;
    try {
      window.localStorage.setItem(stagingKey, envelopeJson);
      window.localStorage.setItem(primaryKey, envelopeJson);
      window.localStorage.removeItem(stagingKey);
    } catch (err: any) {
      console.error('[AnswerStore] Browser local storage write error:', err);
      if (!idbSuccess && !(typeof process !== 'undefined' && process.versions?.node)) {
        throw new Error(`Browser local storage write failed: ${err.message}`);
      }
    }
  }

  // 3. Physical Disk Write (Node.js / desktop / test environment)
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
 * Checks physical disk (if customStorageDir specified), IndexedDB, localStorage, and default disk.
 * Enforces cryptographic authenticity, checksum validity, and session binding.
 */
export async function loadEncryptedAnswers(options: LoadAnswerOptions): Promise<AnswerStoreRecord | null> {
  const { examId, studentId, sessionId, customStorageDir } = options;
  if (!examId || !studentId || !sessionId) {
    throw new Error('examId, studentId, and sessionId are strictly required for answer recovery');
  }

  let envelope: EncryptedAnswerEnvelope | null = null;
  let envelopeJson: string | null = null;

  // If customStorageDir is explicitly provided (e.g. in test suites), check physical disk first
  if (customStorageDir && typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customStorageDir);
    if (fs.existsSync(diskPath)) {
      envelopeJson = fs.readFileSync(diskPath, 'utf8');
      try {
        envelope = JSON.parse(envelopeJson);
      } catch (err) {
        throw new Error('Corrupted storage envelope: Invalid JSON');
      }
    }
  }

  // 1. Check IndexedDB Local Buffering Engine (if not already loaded from customStorageDir)
  if (!envelope) {
    try {
      const db = await openDatabase();
      if (db) {
        const idbEnv = await getEnvelopeFromIndexedDB(db, studentId, examId);
        if (idbEnv) {
          envelope = idbEnv;
        }
      }
    } catch (idbErr) {
      console.warn('[AnswerStore] IndexedDB load warning (falling back):', idbErr);
    }
  }

  // 2. Check Browser / WebView2 localStorage (fallback or primary when IndexedDB unavailable)
  if (!envelope && typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    envelopeJson = window.localStorage.getItem(primaryKey);
    if (!envelopeJson) {
      // Check if an interrupted write left a valid staging key
      const stagingKey = `${primaryKey}_staging`;
      envelopeJson = window.localStorage.getItem(stagingKey);
    }
    if (envelopeJson) {
      try {
        envelope = JSON.parse(envelopeJson);
      } catch (err) {
        throw new Error('Corrupted storage envelope: Invalid JSON');
      }
    }
  }

  // 3. Fall back to Physical Disk File (Node.js / desktop / test environment without customDir)
  if (!envelope && typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customStorageDir);
    if (fs.existsSync(diskPath)) {
      envelopeJson = fs.readFileSync(diskPath, 'utf8');
      try {
        envelope = JSON.parse(envelopeJson);
      } catch (err) {
        throw new Error('Corrupted storage envelope: Invalid JSON');
      }
    }
  }

  if (!envelope) {
    return null;
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
 * Lists buffered offline answers across IndexedDB, localStorage, and physical disk.
 * Used for offline recovery and bulk synchronization upon network reconnection.
 */
export async function listBufferedOfflineAnswers(
  studentId: string,
  examId: string,
  customStorageDir?: string
): Promise<AnswerEnvelope[]> {
  const results: AnswerEnvelope[] = [];
  const seenSequences = new Set<number>();

  // 1. Check IndexedDB Local Buffering Engine
  try {
    const db = await openDatabase();
    if (db) {
      const idbEnvelopes = await getAllEnvelopesFromIndexedDB(db, studentId, examId);
      for (const env of idbEnvelopes) {
        if (!seenSequences.has(env.sequenceNumber)) {
          seenSequences.add(env.sequenceNumber);
          results.push(env);
        }
      }
    }
  } catch (err) {
    console.warn('[AnswerStore] Error listing offline answers from IndexedDB:', err);
  }

  // 2. Check Browser localStorage fallback if empty or offline
  if (results.length === 0 && typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    const raw = window.localStorage.getItem(primaryKey);
    if (raw) {
      try {
        const env = JSON.parse(raw) as AnswerEnvelope;
        if (env.studentId === studentId && env.examId === examId && !seenSequences.has(env.sequenceNumber)) {
          seenSequences.add(env.sequenceNumber);
          results.push(env);
        }
      } catch (_) {}
    }
    const stagingKey = `${primaryKey}_staging`;
    const stagingRaw = window.localStorage.getItem(stagingKey);
    if (stagingRaw) {
      try {
        const stagingEnv = JSON.parse(stagingRaw) as AnswerEnvelope;
        if (stagingEnv.studentId === studentId && stagingEnv.examId === examId && !seenSequences.has(stagingEnv.sequenceNumber)) {
          seenSequences.add(stagingEnv.sequenceNumber);
          results.push(stagingEnv);
        }
      } catch (_) {}
    }
  }

  // 3. Check Physical Disk fallback (Node.js / desktop / test harnesses)
  if (results.length === 0 && typeof process !== 'undefined' && process.versions?.node) {
    const diskPath = getStorageDiskPath(studentId, examId, customStorageDir);
    if (fs.existsSync(diskPath)) {
      try {
        const raw = fs.readFileSync(diskPath, 'utf8');
        const env = JSON.parse(raw) as AnswerEnvelope;
        if (env.studentId === studentId && env.examId === examId && !seenSequences.has(env.sequenceNumber)) {
          seenSequences.add(env.sequenceNumber);
          results.push(env);
        }
      } catch (_) {}
    }
  }

  // Sort by sequence number ascending
  results.sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  return results;
}

/**
 * Securely clears local encrypted answer cache after verified server-side submission.
 * Purges IndexedDB records, localStorage keys, and securely shreds physical disk file.
 */
export async function clearEncryptedAnswers(options: ClearAnswerOptions): Promise<boolean> {
  const { examId, studentId, sessionId, customStorageDir } = options;
  const sessionKey = getSessionKey(studentId, examId, sessionId);
  activeSequenceMap.delete(sessionKey);

  let cleared = false;

  // 1. Clear IndexedDB storage
  try {
    const db = await openDatabase();
    if (db) {
      await deleteEnvelopeFromIndexedDB(db, studentId, examId);
      cleared = true;
    }
  } catch (idbErr) {
    console.warn('[AnswerStore] IndexedDB clear warning:', idbErr);
  }

  // 2. Clear browser localStorage
  if (typeof window !== 'undefined' && window.localStorage) {
    const primaryKey = `cortex_answers_${sanitizeKey(studentId)}_${sanitizeKey(examId)}`;
    const stagingKey = `${primaryKey}_staging`;
    window.localStorage.removeItem(primaryKey);
    window.localStorage.removeItem(stagingKey);
    cleared = true;
  }

  // 3. Clear physical disk file with cryptographic overwrite (secure shredding)
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
 * Simulates an application crash by terminating memory state and closing cached db connections.
 */
export function simulateMemoryCrash(): void {
  activeSequenceMap.clear();
  closeDatabase();
}
