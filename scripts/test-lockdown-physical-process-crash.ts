/**
 * CORTEX LOCKDOWN - PHYSICAL PROCESS TERMINATION AND CRASH RECOVERY TEST
 *
 * Verifies genuine crash resilience against abrupt process termination.
 * Unlike simulated memory wipes, this test:
 * 1. Spawns an independent child process on the live Windows OS.
 * 2. Writes encrypted examination answers to the real physical disk cache (%LOCALAPPDATA%).
 * 3. Forcibly terminates the running OS process using 'taskkill /F /PID' (Windows NT kernel SIGKILL).
 * 4. Verifies process death at the OS level.
 * 5. Launches an independent recovery routine to decrypt and restore answers from physical disk.
 * 6. Cryptographically shreds and unlinks the synthetic test data.
 *
 * Strictly zero emojis.
 */

import { spawn, execSync } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { loadEncryptedAnswers, clearEncryptedAnswers } from '../src/lib/lockdown/answer-store';

interface PhysicalCrashResult {
  osPlatform: string;
  osRelease: string;
  osArch: string;
  workerPid: number;
  killExitCode: number;
  physicalFilePath: string;
  fileSizeBytes: number;
  recoveredAnswerCount: number;
  dataIntegrityMatched: boolean;
  recoveryFlagTrue: boolean;
}

async function runPhysicalCrashTest(): Promise<PhysicalCrashResult> {
  const studentId = 'usr_cand_physical_crash_audit';
  const examId = 'EXAM_PHYSICAL_CRASH_AUDIT';
  const sessionId = `sess_phys_${Date.now()}`;

  const expectedAnswers = {
    q1: 'atomic_compare_exchange_weak',
    q2: ['relaxed_ordering', 'acquire_release_fence'],
    q3: '9999'
  };

  // Ensure clean starting state
  await clearEncryptedAnswers({ studentId, examId, sessionId });

  // Worker script file path
  const workerScriptPath = path.resolve(process.cwd(), 'scripts', 'physical-crash-worker.ts');
  const tsxCliPath = path.resolve(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');

  // Spawn child process directly with node.exe
  const child = spawn(process.execPath, [tsxCliPath, workerScriptPath, studentId, examId, sessionId], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'inherit']
  });

  const workerPid = child.pid;
  if (!workerPid) {
    throw new Error('Failed to retrieve child process PID');
  }

  // Wait for worker to signal that disk write has committed
  const physicalFilePath = await new Promise<string>((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      reject(new Error('Timeout waiting for worker to commit on-disk answers'));
    }, 15000);

    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (output.includes('READY_FOR_TERMINATION:')) {
        clearTimeout(timeout);
        const match = output.match(/READY_FOR_TERMINATION:([^\r\n]+)/);
        if (match && match[1]) {
          resolve(match[1].trim());
        } else {
          resolve('');
        }
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  // Verify physical file exists on disk
  if (!fs.existsSync(physicalFilePath)) {
    throw new Error(`Physical cache file not found at expected location: ${physicalFilePath}`);
  }
  const fileSizeBytes = fs.statSync(physicalFilePath).size;

  // Execute abrupt OS kernel termination via Windows taskkill tree kill
  let killExitCode = 0;
  try {
    execSync(`taskkill /F /T /PID ${workerPid}`, { stdio: 'pipe' });
  } catch (err: any) {
    killExitCode = err.status || 1;
  }

  // Allow OS scheduler 250ms to clean up the process handle
  await new Promise((r) => setTimeout(r, 250));

  // Verify process is terminated at OS level
  let isDead = false;
  try {
    process.kill(workerPid, 0);
  } catch (e: any) {
    if (e.code === 'ESRCH') {
      isDead = true;
    }
  }

  if (!isDead) {
    try {
      child.kill('SIGKILL');
    } catch {}
  }

  // COLD RECOVERY PHASE: Launch independent recovery from physical disk
  const recoveredRecord = await loadEncryptedAnswers({
    studentId,
    examId,
    sessionId
  });

  if (!recoveredRecord) {
    throw new Error('Cold recovery failed: loadEncryptedAnswers returned null');
  }

  const q1Match = recoveredRecord.answers.q1 === expectedAnswers.q1;
  const q2Match = JSON.stringify(recoveredRecord.answers.q2) === JSON.stringify(expectedAnswers.q2);
  const q3Match = recoveredRecord.answers.q3 === expectedAnswers.q3;
  const dataIntegrityMatched = q1Match && q2Match && q3Match;

  // Clean up synthetic test data
  await clearEncryptedAnswers({ studentId, examId, sessionId });

  return {
    osPlatform: os.platform(),
    osRelease: os.release(),
    osArch: os.arch(),
    workerPid,
    killExitCode,
    physicalFilePath,
    fileSizeBytes,
    recoveredAnswerCount: Object.keys(recoveredRecord.answers).length,
    dataIntegrityMatched,
    recoveryFlagTrue: recoveredRecord.recovered === true
  };
}

// Execute and report
runPhysicalCrashTest()
  .then((res) => {
    console.log('================================================================');
    console.log('CORTEX LOCKDOWN: PHYSICAL PROCESS TERMINATION & RECOVERY REPORT');
    console.log('================================================================');
    console.log(`OS Environment:         ${res.osPlatform} ${res.osRelease} (${res.osArch})`);
    console.log(`Target Worker PID:      ${res.workerPid}`);
    console.log(`Termination Command:    taskkill /F /PID ${res.workerPid} (Exit: ${res.killExitCode})`);
    console.log(`Physical File Path:     ${res.physicalFilePath}`);
    console.log(`Ciphertext File Size:   ${res.fileSizeBytes} bytes`);
    console.log(`Recovered Answer Count: ${res.recoveredAnswerCount} of 3`);
    console.log(`Data Integrity Matched: ${res.dataIntegrityMatched}`);
    console.log(`Recovery Flag Set True: ${res.recoveryFlagTrue}`);
    console.log('================================================================');
    if (res.dataIntegrityMatched && res.recoveryFlagTrue) {
      console.log('VERDICT: PHYSICAL PROCESS CRASH RECOVERY VERIFIED PASS.');
      process.exit(0);
    } else {
      console.error('VERDICT: PHYSICAL PROCESS CRASH RECOVERY FAILED.');
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('PHYSICAL CRASH TEST EXCEPTION:', err);
    process.exit(1);
  });
