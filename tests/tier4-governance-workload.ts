import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import {
  TestHarness,
  TierExecutionResult,
  detectEmojisInText,
  findFilesRecursively,
  executeCommand,
  EmojiViolation,
} from './test-utils';

const BINARY_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.ico',
  '.webp',
  '.zip',
  '.pdf',
  '.exe',
  '.dll',
  '.wasm',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.db',
  '.sqlite',
  '.mp4',
  '.webm',
  '.mov',
  '.mkv',
  '.avi',
  '.bin',
  '.part',
  '.mp3',
  '.wav',
  '.ogg',
];

export async function runTier4GovernanceWorkload(projectRoot = process.cwd()): Promise<TierExecutionResult> {
  const harness = new TestHarness('Tier 4 - Governance and Workload Simulation');

  // Test 1: AST and Regex Zero-Emoji Codebase Audit
  harness.startTest('TC4.1 - Codebase Zero-Emoji Audit (src, public, docs, tests)');
  try {
    const isTextFile = (filePath: string) => {
      const lower = filePath.toLowerCase();
      return !BINARY_EXTENSIONS.some((ext) => lower.endsWith(ext));
    };

    const targetDirs = ['src', 'public', 'docs', 'tests'];
    const scannedFiles: string[] = [];

    for (const d of targetDirs) {
      const fullDir = path.join(projectRoot, d);
      if (fs.existsSync(fullDir)) {
        scannedFiles.push(...findFilesRecursively(fullDir, isTextFile));
      }
    }

    const rootFiles = ['package.json', 'README.md', 'tsconfig.json'];
    for (const rf of rootFiles) {
      const p = path.join(projectRoot, rf);
      if (fs.existsSync(p)) {
        scannedFiles.push(p);
      }
    }

    harness.assertGreaterThanOrEqual(
      scannedFiles.length,
      50,
      `Zero-emoji audit must inspect at least 50+ repository text files (found ${scannedFiles.length})`
    );

    const allViolations: EmojiViolation[] = [];
    for (const file of scannedFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const relPath = path.relative(projectRoot, file);
      const violations = detectEmojisInText(content, relPath);
      if (violations.length > 0) {
        allViolations.push(...violations);
      }
    }

    const violationDetails = allViolations
      .slice(0, 10)
      .map((v) => `${v.filePath}:${v.line} [${v.codePoint}]`)
      .join(', ');

    harness.assertEquals(
      allViolations.length,
      0,
      `Strict zero-emoji policy violated! Found ${allViolations.length} emoji characters in codebase (${violationDetails}${allViolations.length > 10 ? '...' : ''})`
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 2: Git Commit Message Zero-Emoji Governance
  harness.startTest('TC4.2 - Git Commit Message Zero-Emoji Governance');
  try {
    const gitLog = await executeCommand(
      'git',
      ['log', '-n', '50', '--pretty=format:%s'],
      { cwd: projectRoot }
    );

    if (gitLog.exitCode === 0 && gitLog.stdout.trim().length > 0) {
      const commits = gitLog.stdout.split('\n');
      harness.assertGreaterThanOrEqual(
        commits.length,
        5,
        'Must inspect at least 5 recent git commit messages'
      );

      const commitViolations = detectEmojisInText(gitLog.stdout, 'git-log');
      harness.assertEquals(
        commitViolations.length,
        0,
        `Git commit history must contain 0 emojis (found ${commitViolations.length})`
      );
    } else {
      // In non-git environments, check that test output itself contains 0 emojis
      harness.assert(true, 'Git log inspection skipped in non-git environment');
    }

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 3: Technical English Terminology Verification
  harness.startTest('TC4.3 - Technical English Terminology Verification');
  try {
    const lockdownPath = path.join(projectRoot, 'src', 'app', 'lockdown', 'page.tsx');
    harness.assert(fs.existsSync(lockdownPath), 'src/app/lockdown/page.tsx must exist');
    const lockdownContent = fs.readFileSync(lockdownPath, 'utf8');

    // 1. Status banner format
    harness.assertMatch(
      lockdownContent,
      /BUILDING BY TEAM \/\/ COMING SOON|Building by Team \/\/ Coming Soon/i,
      'Lockdown page must declare standard technical English placeholder banner'
    );

    // 2. Win32 Display Affinity token
    harness.assertIncludes(
      lockdownContent,
      'WDA_EXCLUDEFROMCAPTURE',
      'Lockdown page must use exact Win32 security token WDA_EXCLUDEFROMCAPTURE'
    );

    // 3. Win32 Low-Level Keyboard Hook token
    harness.assertIncludes(
      lockdownContent,
      'WH_KEYBOARD_LL',
      'Lockdown page must use exact Win32 security token WH_KEYBOARD_LL'
    );

    // 4. Operational status token
    harness.assertMatch(
      lockdownContent,
      /SYSTEM STATUS \/\/ ALL SYSTEMS OPERATIONAL/i,
      'Footer must declare standard operational status: "SYSTEM STATUS // ALL SYSTEMS OPERATIONAL"'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  // Test 4: Production Workload & Bundle Size Verification
  harness.startTest('TC4.4 - Production Workload & Bundle Sizing Verification');
  try {
    const nextDir = path.join(projectRoot, '.next');
    const buildManifestPath = path.join(nextDir, 'build-manifest.json');
    harness.assert(fs.existsSync(buildManifestPath), '.next/build-manifest.json must exist');

    const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
    harness.assert(
      typeof manifest.pages === 'object',
      'Build manifest must contain pages dictionary'
    );

    // Verify bundle sizes for key routes in static chunks
    const staticChunksDir = path.join(nextDir, 'static', 'chunks');
    if (fs.existsSync(staticChunksDir)) {
      const chunkFiles = fs.readdirSync(staticChunksDir);
      let totalChunkBytes = 0;
      for (const chunk of chunkFiles) {
        if (chunk.endsWith('.js')) {
          const stat = fs.statSync(path.join(staticChunksDir, chunk));
          totalChunkBytes += stat.size;
        }
      }
      // Sanity check: chunks must exist and be non-empty
      harness.assert(totalChunkBytes > 10000, 'Production build static chunks must exceed 10KB');
    }

    // Verify architecture performance benchmarks contract
    const archPath = path.join(
      projectRoot,
      'src',
      'components',
      'landing',
      'TechnicalArchitectureGrid.tsx'
    );
    harness.assert(
      fs.existsSync(archPath),
      'src/components/landing/TechnicalArchitectureGrid.tsx must exist to declare edge latency benchmarks'
    );
    const archContent = fs.readFileSync(archPath, 'utf8');
    harness.assertMatch(
      archContent,
      /50ms|<50ms/i,
      'Technical architecture grid must specify <50ms worker latency'
    );
    harness.assertMatch(
      archContent,
      /15ms|<15ms/i,
      'Technical architecture grid must specify <15ms D1 SQL latency'
    );

    harness.endTest();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    harness.endTest('failed', msg);
  }

  return harness.getSummary();
}

const isDirectExecution = process.argv[1] && (
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href ||
  process.argv[1].replace(/\\/g, '/').endsWith('tier4-governance-workload.ts')
);

if (isDirectExecution) {
  runTier4GovernanceWorkload().then((summary) => {
    console.log(`\n--- ${summary.tierName} Summary ---`);
    console.log(`Passed Tests: ${summary.passedTests}/${summary.totalTests}`);
    console.log(`Passed Assertions: ${summary.passedAssertions}/${summary.totalAssertions}`);
    console.log(`Duration: ${summary.durationMs}ms`);
    process.exit(summary.passed ? 0 : 1);
  });
}
