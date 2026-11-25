import { ExecutionRequest, ExecutionResult } from '@/lib/execution/types';
import { getExecutionMode } from '@/lib/execution/config';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';
import { getLanguageConfig } from '@/config/languages';
import { resolveMainFile } from '@/lib/execution/path-sanitizer';

export async function executeArenaTestCase(req: ExecutionRequest): Promise<ExecutionResult> {
  const mode = getExecutionMode();
  const langConfig = getLanguageConfig(req.language);
  const mainFile = resolveMainFile(req.files, req.entrypoint, langConfig);

  const execReq: ExecutionRequest = {
    ...req,
    entrypoint: req.entrypoint || mainFile?.name || langConfig.defaultFileName,
  };

  let result: ExecutionResult;

  if (mode === 'docker') {
    const { executeInDockerSandbox } = await import('@/lib/execution/docker-sandbox');
    result = await executeInDockerSandbox(execReq);
  } else if (mode === 'development') {
    const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
    result = await executeInLocalSandbox(execReq);
  } else {
    result = await executeInCloudRunner(execReq);
    if (
      langConfig.id === 'sql' &&
      result.status === 'system_error' &&
      process.env.NODE_ENV !== 'production'
    ) {
      const { executeInLocalSandbox } = await import('@/lib/execution/local-sandbox');
      result = await executeInLocalSandbox(execReq);
    }
  }

  return {
    ...result,
    stdout: (result.stdout || '').replace(/\r\n/g, '\n'),
    stderr: (result.stderr || '').replace(/\r\n/g, '\n'),
    compileOutput: result.compileOutput
      ? result.compileOutput.replace(/\r\n/g, '\n')
      : result.compileOutput,
  };
}
