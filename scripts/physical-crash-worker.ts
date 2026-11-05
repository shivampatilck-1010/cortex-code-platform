import { saveEncryptedAnswers, getStorageDiskPath } from '../src/lib/lockdown/answer-store';

async function main() {
  const studentId = process.argv[2] || 'usr_cand_physical_crash_audit';
  const examId = process.argv[3] || 'EXAM_PHYSICAL_CRASH_AUDIT';
  const sessionId = process.argv[4] || 'sess_phys_crash';

  const answers = {
    q1: 'atomic_compare_exchange_weak',
    q2: ['relaxed_ordering', 'acquire_release_fence'],
    q3: '9999'
  };

  await saveEncryptedAnswers({
    studentId,
    examId,
    sessionId,
    answers,
    sequenceNumber: 1
  });

  const filePath = getStorageDiskPath(studentId, examId);
  process.stdout.write(`READY_FOR_TERMINATION:${filePath}\n`);

  // Stay alive until ungracefully killed by OS
  setInterval(() => {}, 5000);
}

main().catch((err) => {
  process.stderr.write(String(err) + '\n');
  process.exit(1);
});
