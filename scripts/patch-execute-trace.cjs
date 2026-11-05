const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', 'src', 'app', 'api', 'v1', 'execute', 'route.ts');
let code = fs.readFileSync(targetPath, 'utf8');

// Normalize line endings for replacement
const isCRLF = code.includes('\r\n');
const nl = isCRLF ? '\r\n' : '\n';

// 1. Add imports
const importTarget = "import { executionRateLimiter } from '@/lib/execution/rate-limiter';";
const importReplacement = "import { executionRateLimiter } from '@/lib/execution/rate-limiter';" + nl +
  "import { getAdapter, hasTracingSupport } from '@/lib/visualization/registry';" + nl +
  "import '@/lib/visualization/adapters';";

if (!code.includes("from '@/lib/visualization/registry'")) {
  code = code.replace(importTarget, importReplacement);
}

// 2. Destructure trace parameter
const bodyTarget = "const { projectId, language, stdin, args, version, entrypoint, files: bodyFiles } = body || {};";
const bodyReplacement = "const { projectId, language, stdin, args, version, entrypoint, files: bodyFiles, trace: shouldTrace } = body || {};";
code = code.replace(bodyTarget, bodyReplacement);

// 3. Prepare traced files if adapter exists
const execTarget = `    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: version || langConfig.version,
      files: validation.sanitizedFiles!,
      stdin: typeof stdin === 'string' ? stdin : '',
      args: Array.isArray(args) ? args.filter((a) => typeof a === 'string').slice(0, 10) : [],
      entrypoint: entrypoint || langConfig.defaultFileName,
    };`.replace(/\n/g, nl);

const execReplacement = `    const adapter = shouldTrace && hasTracingSupport(normalizedLang) ? getAdapter(normalizedLang) : undefined;
    let filesToExec = validation.sanitizedFiles!;
    let entryToExec = entrypoint || langConfig.defaultFileName;

    if (adapter) {
      const tracedSetup = adapter.prepareTracedExecution(
        validation.sanitizedFiles!,
        entryToExec,
        stdin
      );
      filesToExec = tracedSetup.tracedFiles;
      entryToExec = tracedSetup.entrypoint;
    }

    const execReq: ExecutionRequest = {
      language: langConfig.id,
      version: version || langConfig.version,
      files: filesToExec,
      stdin: typeof stdin === 'string' ? stdin : '',
      args: Array.isArray(args) ? args.filter((a) => typeof a === 'string').slice(0, 10) : [],
      entrypoint: entryToExec,
    };`.replace(/\n/g, nl);

code = code.replace(execTarget, execReplacement);

// 4. Return trace session in response
const resTarget = `    return NextResponse.json(
      {
        status: result.status,
        exitCode: result.exitCode,
        stdout: result.stdout,
        stderr: result.stderr,`.replace(/\n/g, nl);

const resReplacement = `    let traceSession = undefined;
    if (adapter) {
      traceSession = adapter.parseTraceOutput(
        result.stdout || '',
        result.stderr || '',
        result.exitCode,
        result.executionTimeMs
      );
    }

    return NextResponse.json(
      {
        status: result.status,
        exitCode: result.exitCode,
        stdout: traceSession ? traceSession.stdout : result.stdout,
        stderr: traceSession ? traceSession.stderr : result.stderr,
        trace: traceSession,`.replace(/\n/g, nl);

code = code.replace(resTarget, resReplacement);

fs.writeFileSync(targetPath, code, 'utf8');
console.log('Successfully patched execute/route.ts with trace support');
