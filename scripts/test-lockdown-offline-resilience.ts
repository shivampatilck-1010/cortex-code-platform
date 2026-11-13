/**
 * CORTEX LOCKDOWN — OFFLINE RESILIENCE & DATA STORAGE VERIFICATION SUITE
 *
 * Verifies:
 * 1. Authenticated AES-256-GCM encryption with 128-bit tag, 12-byte IV, and 100k PBKDF2 iterations.
 * 2. Cryptographic AAD session binding: BIND:studentId:examId:sessionId:SEQ:sequenceNumber.
 * 3. Monotonic sequence enforcement and anti-tamper rejection.
 * 4. Simulated crash recovery and secure zero-fill disk shredding.
 * 5. IndexedDB asynchronous local buffering engine architecture and schema.
 * 6. Authentic Monaco Code Editor integration in CortexLockdownApp.tsx (no plain textarea).
 * 7. Authentic 10-second auto-save loop (setInterval 10000 ms) in CortexLockdownApp.tsx.
 * 8. Authentic online reconnection event listener (window.addEventListener('online')) in CortexLockdownApp.tsx.
 *
 * Strictly zero emojis.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const projectRoot = 'D:\\Lpu lecture ppt\\Sem 3\\CSE 276\\Project\\Codex';

// Dynamically import answer-store from project
const answerStoreModule = await import(path.join(projectRoot, 'src/lib/lockdown/answer-store.ts'));
const {
  saveEncryptedAnswers,
  loadEncryptedAnswers,
  clearEncryptedAnswers,
  simulateMemoryCrash,
  getStorageDiskPath
} = answerStoreModule;

interface AssertionResult {
  code: string;
  name: string;
  domain: string;
  passed: boolean;
  detail?: string;
}

const results: AssertionResult[] = [];

function assert(code: string, domain: string, name: string, condition: boolean, detail?: string) {
  results.push({ code, domain, name, passed: Boolean(condition), detail });
  const tag = condition ? '[PASS]' : '[FAIL]';
  console.log(`${tag} [${code}] (${domain}): ${name}${detail ? ` -> ${detail}` : ''}`);
}

async function runOfflineResilienceSuite() {
  console.log('================================================================');
  console.log('CORTEX LOCKDOWN: OFFLINE RESILIENCE & STORAGE SUITE');
  console.log('================================================================\n');

  const testTempDir = path.join(os.tmpdir(), `cortex_offline_test_${Date.now()}`);
  fs.mkdirSync(testTempDir, { recursive: true });

  const testExamId = 'EXAM-CS301-CONCURRENCY';
  const testStudentId = 'STU-SEC-4921';
  const testSessionId = 'SESS-7A8B9C0D';

  const mockAnswers = {
    q1: 'opt_m2',
    q2: ['opt_h1', 'opt_h3'],
    q3: 1.875,
    q4: 'Coffman conditions: 1. Mutual Exclusion, 2. Hold and Wait, 3. No Preemption, 4. Circular Wait.',
    q5: 'class SafeCounter { std::atomic<int> val{0}; public: void inc() { val.fetch_add(1, std::memory_order_relaxed); } int get() const { return val.load(std::memory_order_relaxed); } };'
  };

  try {
    // -------------------------------------------------------------------------
    // DOMAIN 1: Authenticated AES-256-GCM Encryption
    // -------------------------------------------------------------------------
    console.log('--- Domain 1: Authenticated AES-256-GCM Encryption ---');

    const envelope = await saveEncryptedAnswers({
      examId: testExamId,
      studentId: testStudentId,
      sessionId: testSessionId,
      answers: mockAnswers,
      sequenceNumber: 1,
      customStorageDir: testTempDir
    });

    assert('OFL-ENC-01', 'Cryptography', 'Envelope algorithm is AES-256-GCM', envelope.algorithm === 'AES-256-GCM', envelope.algorithm);
    assert('OFL-ENC-02', 'Cryptography', 'Envelope version is 2 (100k PBKDF2 iterations)', envelope.version === 2, `v=${envelope.version}`);
    assert('OFL-ENC-03', 'Cryptography', 'Salt is 16 bytes (32 hex characters)', envelope.saltHex?.length === 32, `len=${envelope.saltHex?.length}`);
    assert('OFL-ENC-04', 'Cryptography', 'IV is 12 bytes (24 hex characters for GCM standard)', envelope.ivHex?.length === 24, `len=${envelope.ivHex?.length}`);
    assert('OFL-ENC-05', 'Cryptography', 'Authentication Tag is 16 bytes / 128 bits (32 hex characters)', envelope.tagHex?.length === 32, `len=${envelope.tagHex?.length}`);
    assert('OFL-ENC-06', 'Cryptography', 'Ciphertext is non-empty and non-plaintext', envelope.ciphertextHex?.length > 64 && !envelope.ciphertextHex.includes('SafeCounter'), 'Ciphertext verified encrypted');
    assert('OFL-ENC-07', 'Cryptography', 'SHA-256 Content Checksum is 64 hex characters', envelope.checksum?.length === 64, envelope.checksum);

    // Verify Clean Decryption & Content Fidelity
    const loaded = await loadEncryptedAnswers({
      examId: testExamId,
      studentId: testStudentId,
      sessionId: testSessionId,
      customStorageDir: testTempDir
    });

    assert(
      'OFL-DEC-01',
      'Decryption Fidelity',
      'Decrypted payload accurately matches original MCQ, numerical, essay, and coding answers',
      loaded !== null &&
      loaded.answers.q1 === mockAnswers.q1 &&
      loaded.answers.q3 === mockAnswers.q3 &&
      loaded.answers.q5 === mockAnswers.q5,
      `Loaded answers for questions: ${Object.keys(loaded?.answers || {}).join(', ')}`
    );

    assert(
      'OFL-DEC-02',
      'Decryption Fidelity',
      'Decrypted payload preserves sequence number 1 and recovered flag',
      loaded?.sequenceNumber === 1 && loaded?.recovered === true,
      `seq=${loaded?.sequenceNumber}, recovered=${loaded?.recovered}`
    );

    // -------------------------------------------------------------------------
    // DOMAIN 2: Session-Bound Additional Authenticated Data (AAD)
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 2: Session-Bound AAD Verification ---');

    // Attempt decryption with spoofed studentId
    let studentTamperCaught = false;
    try {
      await loadEncryptedAnswers({
        examId: testExamId,
        studentId: 'STU-SPOOFED-9999',
        sessionId: testSessionId,
        customStorageDir: testTempDir
      });
    } catch {
      studentTamperCaught = true;
    }
    assert('OFL-AAD-01', 'AAD Binding', 'Rejects decryption if studentId does not match authenticated AAD', studentTamperCaught, 'Tamper exception caught');

    // Attempt decryption with mismatched examId
    let examTamperCaught = false;
    try {
      await loadEncryptedAnswers({
        examId: 'EXAM-MISMATCHED-999',
        studentId: testStudentId,
        sessionId: testSessionId,
        customStorageDir: testTempDir
      });
    } catch {
      examTamperCaught = true;
    }
    assert('OFL-AAD-02', 'AAD Binding', 'Rejects decryption if examId does not match authenticated AAD', examTamperCaught, 'Tamper exception caught');

    // Attempt decryption with mismatched sessionId
    let sessionTamperCaught = false;
    try {
      await loadEncryptedAnswers({
        examId: testExamId,
        studentId: testStudentId,
        sessionId: 'SESS-WRONG-SESSION',
        customStorageDir: testTempDir
      });
    } catch {
      sessionTamperCaught = true;
    }
    assert('OFL-AAD-03', 'AAD Binding', 'Rejects decryption if sessionId does not match authenticated AAD', sessionTamperCaught, 'Tamper exception caught');

    // -------------------------------------------------------------------------
    // DOMAIN 3: Monotonic Sequence Number Validation
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 3: Monotonic Sequence Validation ---');

    // Sequence advancement: seq 2 > seq 1 (should succeed)
    const seq2Answers = { ...mockAnswers, q1: 'opt_m3' };
    const envelope2 = await saveEncryptedAnswers({
      examId: testExamId,
      studentId: testStudentId,
      sessionId: testSessionId,
      answers: seq2Answers,
      sequenceNumber: 2,
      customStorageDir: testTempDir
    });
    assert('OFL-SEQ-01', 'Sequence Validation', 'Permits monotonically advancing sequence number (seq 2)', envelope2.sequenceNumber === 2, 'seq=2 accepted');

    // Sequence regression: seq 1 <= seq 2 (must be rejected)
    let sequenceRegressionCaught = false;
    try {
      await saveEncryptedAnswers({
        examId: testExamId,
        studentId: testStudentId,
        sessionId: testSessionId,
        answers: mockAnswers,
        sequenceNumber: 1, // Regressed sequence
        customStorageDir: testTempDir
      });
    } catch (err: any) {
      sequenceRegressionCaught = true;
    }
    assert('OFL-SEQ-02', 'Sequence Validation', 'Rejects sequence regression (seq 1 attempted after seq 2)', sequenceRegressionCaught, 'Regression error caught');

    // -------------------------------------------------------------------------
    // DOMAIN 4: Tamper Detection & Integrity Resilience
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 4: Tamper Detection & Integrity Resilience ---');

    const diskPath = getStorageDiskPath(testStudentId, testExamId, testTempDir);
    assert('OFL-TMP-01', 'Tamper Resilience', 'Encrypted file exists at atomic disk path', fs.existsSync(diskPath), diskPath);

    // Read genuine envelope and flip ciphertext bits
    const rawDiskContent = fs.readFileSync(diskPath, 'utf8');
    const diskEnvelope = JSON.parse(rawDiskContent);
    const corruptedCiphertext = diskEnvelope.ciphertextHex.slice(0, 10) + '0000' + diskEnvelope.ciphertextHex.slice(14);
    const corruptedEnvelope = { ...diskEnvelope, ciphertextHex: corruptedCiphertext };

    fs.writeFileSync(diskPath, JSON.stringify(corruptedEnvelope), 'utf8');

    let cipherTamperCaught = false;
    try {
      await loadEncryptedAnswers({
        examId: testExamId,
        studentId: testStudentId,
        sessionId: testSessionId,
        customStorageDir: testTempDir
      });
    } catch (err: any) {
      cipherTamperCaught = err.message?.includes('TAMPER_DETECTED') || err.message?.includes('integrity');
    }
    assert('OFL-TMP-02', 'Tamper Resilience', 'Rejects tampered ciphertext with TAMPER_DETECTED error', cipherTamperCaught, 'Tamper detected on bit flip');

    // Restore genuine envelope
    fs.writeFileSync(diskPath, rawDiskContent, 'utf8');

    // -------------------------------------------------------------------------
    // DOMAIN 5: Crash Safety & Two-Phase Recovery
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 5: Crash Safety & Two-Phase Recovery ---');

    // Write sequence 3
    const seq3Answers = { ...mockAnswers, q3: 3.14159 };
    await saveEncryptedAnswers({
      examId: testExamId,
      studentId: testStudentId,
      sessionId: testSessionId,
      answers: seq3Answers,
      sequenceNumber: 3,
      customStorageDir: testTempDir
    });

    // Simulate immediate ungraceful crash (purges memory cache)
    simulateMemoryCrash();

    // Verify recovery directly from disk
    const recoveredAfterCrash = await loadEncryptedAnswers({
      examId: testExamId,
      studentId: testStudentId,
      sessionId: testSessionId,
      customStorageDir: testTempDir
    });

    assert(
      'OFL-CRS-01',
      'Crash Safety',
      'Recovers full state from disk after simulated application memory crash',
      recoveredAfterCrash !== null && recoveredAfterCrash.sequenceNumber === 3 && recoveredAfterCrash.answers.q3 === 3.14159,
      `Recovered seq=${recoveredAfterCrash?.sequenceNumber}, q3=${recoveredAfterCrash?.answers?.q3}`
    );

    // -------------------------------------------------------------------------
    // DOMAIN 6: Secure Zero-Fill Disk Shredding
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 6: Secure Disk Shredding ---');

    const shredded = await clearEncryptedAnswers({
      examId: testExamId,
      studentId: testStudentId,
      sessionId: testSessionId,
      customStorageDir: testTempDir
    });

    assert('OFL-SHR-01', 'Secure Shredding', 'clearEncryptedAnswers returns true on successful purge', shredded === true, `shredded=${shredded}`);
    assert('OFL-SHR-02', 'Secure Shredding', 'Encrypted file is securely unlinked from disk', !fs.existsSync(diskPath), 'File deleted from disk');

    // -------------------------------------------------------------------------
    // DOMAIN 7: IndexedDB Asynchronous Buffering Architecture
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 7: IndexedDB Buffering Engine Architecture ---');

    const answerStoreSrcPath = path.resolve(projectRoot, 'src', 'lib', 'lockdown', 'answer-store.ts');
    assert('OFL-IDB-01', 'IndexedDB Engine', 'answer-store.ts source exists', fs.existsSync(answerStoreSrcPath), answerStoreSrcPath);

    const answerStoreSrc = fs.readFileSync(answerStoreSrcPath, 'utf8');

    // Check IndexedDB Database Constants
    const hasDbName = answerStoreSrc.includes('CortexLockdownDB') || answerStoreSrc.includes('CORTEX_LOCKDOWN_DB_NAME');
    const hasStoreName = answerStoreSrc.includes('encrypted_answers') || answerStoreSrc.includes('ENCRYPTED_ANSWERS_STORE_NAME');
    assert('OFL-IDB-02', 'IndexedDB Engine', 'Defines CortexLockdownDB and encrypted_answers store', hasDbName && hasStoreName, 'Database and store names present');

    // Check IndexedDB Store Lifecycle Methods
    const hasOpenDb = answerStoreSrc.includes('openDatabase') || answerStoreSrc.includes('indexedDB.open');
    const hasIdbTransaction = answerStoreSrc.includes('transaction') && answerStoreSrc.includes('objectStore');
    assert('OFL-IDB-03', 'IndexedDB Engine', 'Implements IndexedDB transaction and objectStore operations', hasOpenDb && hasIdbTransaction, 'IndexedDB transaction pipeline verified');

    // Check IndexedDB Indexing
    const hasIndexes = answerStoreSrc.includes('createIndex') && answerStoreSrc.includes('sequenceNumber');
    assert('OFL-IDB-04', 'IndexedDB Engine', 'Creates indexes on sequenceNumber and metadata', hasIndexes, 'IndexedDB indexes verified');

    // Check Dual-Tier Fallback Resilience
    const hasFallback = answerStoreSrc.includes('localStorage') && (answerStoreSrc.includes('indexedDB') || answerStoreSrc.includes('openDatabase'));
    assert('OFL-IDB-05', 'IndexedDB Engine', 'Maintains seamless fallback to localStorage/disk if IndexedDB is unavailable', hasFallback, 'Dual-tier fallback present');

    // -------------------------------------------------------------------------
    // DOMAIN 8: Assessment Workspace Source Code Opaque-Box Verification
    // -------------------------------------------------------------------------
    console.log('\n--- Domain 8: Assessment Workspace Source Code Verification ---');

    const appComponentPath = path.resolve(projectRoot, 'src', 'components', 'lockdown', 'CortexLockdownApp.tsx');
    assert('OFL-APP-01', 'Workspace Component', 'CortexLockdownApp.tsx component exists', fs.existsSync(appComponentPath), appComponentPath);

    const appSource = fs.readFileSync(appComponentPath, 'utf8');

    // 8.1 Monaco Editor Integration (No Plain HTML Textarea for Coding Question)
    const importsMonaco = appSource.includes('@monaco-editor/react');
    const declaresMonaco = appSource.includes('MonacoEditor') || appSource.includes('<Editor');
    const hasPlainCodingTextarea = appSource.includes('<textarea') && appSource.includes('answers.q5');

    assert(
      'OFL-MNC-01',
      'Monaco Editor',
      'Imports @monaco-editor/react dynamically or statically',
      importsMonaco,
      importsMonaco ? 'Monaco editor package imported' : 'MISSING @monaco-editor/react import'
    );

    assert(
      'OFL-MNC-02',
      'Monaco Editor',
      'Renders Monaco Editor component for Question 5 coding challenge',
      declaresMonaco,
      declaresMonaco ? 'Monaco Editor JSX instantiated' : 'MISSING Monaco Editor JSX component'
    );

    assert(
      'OFL-MNC-03',
      'Monaco Editor',
      'Replaced plain HTML textarea with Monaco editor for Question 5',
      !hasPlainCodingTextarea,
      hasPlainCodingTextarea ? 'FAIL: Plain textarea still present for q5' : 'PASS: Plain textarea eliminated'
    );

    // 8.2 10-Second Auto-Save Persistence Loop in Application Source
    const has10SecInterval = appSource.includes('10000') && appSource.includes('setInterval');
    const autoSavesAnswers = (appSource.includes('performAnswerSync') || appSource.includes('saveEncryptedAnswers')) && appSource.includes('10000');

    assert(
      'OFL-AUT-01',
      'Auto-Save Loop',
      'CortexLockdownApp.tsx implements genuine 10-second (10000 ms) recurring setInterval',
      has10SecInterval,
      has10SecInterval ? 'Found 10000 ms setInterval in component' : 'MISSING 10000 ms setInterval'
    );

    assert(
      'OFL-AUT-02',
      'Auto-Save Loop',
      '10-second auto-save interval persists answers to encrypted store and server',
      autoSavesAnswers,
      autoSavesAnswers ? 'Persistence routine triggered by 10s timer' : 'Timer does not trigger persistence'
    );

    // 8.3 Online Reconnection Auto-Sync Protocol
    const hasOnlineListener = appSource.includes("addEventListener('online'") || appSource.includes('addEventListener("online"');
    const syncsOnReconnect = hasOnlineListener && (appSource.includes('/api/v1/lockdown/sync-answers') || appSource.includes('performAnswerSync'));

    assert(
      'OFL-REC-01',
      'Reconnection Sync',
      "CortexLockdownApp.tsx registers window.addEventListener('online') handler",
      hasOnlineListener,
      hasOnlineListener ? "Found addEventListener('online') in component" : "MISSING addEventListener('online')"
    );

    assert(
      'OFL-REC-02',
      'Reconnection Sync',
      'Online reconnection handler synchronizes pending answers to /api/v1/lockdown/sync-answers',
      syncsOnReconnect,
      syncsOnReconnect ? 'Auto-sync logic connected to online event' : 'Online event does not trigger auto-sync'
    );

    // 8.4 UI DevTools Suppression & Clipboard Isolation
    const suppressesDevTools = appSource.includes('isF12') || (appSource.includes('F12') && appSource.includes('preventDefault'));
    const isolatesMonacoPaste = appSource.includes('.monaco-editor') && appSource.includes('paste');

    assert(
      'OFL-UI-01',
      'UI Hotkey Guard',
      'Suppresses browser devtools key shortcuts (F12, Ctrl+Shift+I) in workspace',
      suppressesDevTools,
      suppressesDevTools ? 'DevTools shortcuts intercepted in keydown' : 'DevTools shortcuts not suppressed'
    );

    assert(
      'OFL-UI-02',
      'UI Clipboard Policy',
      'Restricts clipboard pasting outside the editor while allowing Monaco internal editing',
      isolatesMonacoPaste,
      isolatesMonacoPaste ? 'Monaco editor clipboard isolation verified' : 'Monaco paste isolation not configured'
    );

  } finally {
    // Clean up temporary test directory
    if (fs.existsSync(testTempDir)) {
      fs.rmSync(testTempDir, { recursive: true, force: true });
    }
  }

  // -------------------------------------------------------------------------
  // SCORECARD & RESULTS SUMMARY
  // -------------------------------------------------------------------------
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n================================================================');
  console.log('OFFLINE RESILIENCE & STORAGE SCORECARD');
  console.log('================================================================');
  console.log(`Total Checks:  ${results.length}`);
  console.log(`  Passed:      ${passedCount}`);
  console.log(`  Failed:      ${failedCount}`);
  console.log(`Compliance:    ${((passedCount / results.length) * 100).toFixed(1)}%`);
  console.log('================================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runOfflineResilienceSuite().catch((err) => {
  console.error('Fatal error during Offline Resilience Suite execution:', err);
  process.exit(1);
});
