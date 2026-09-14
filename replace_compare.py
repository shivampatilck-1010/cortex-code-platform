import os
import re

filepath = 'src/app/compare/page.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove executeInCloudSandbox import
content = content.replace("import { executeInCloudSandbox } from '@/lib/execution/engine';", "")

new_handle_run_benchmark = '''  const handleRunBenchmark = async () => {
    handleRun('BOTH');
  };

  const handleRun = async (runType: 'A' | 'B' | 'BOTH') => {
    if (isComparing || isRunningA || isRunningB) return;
    
    if (runType === 'A' || runType === 'BOTH') setIsRunningA(true);
    if (runType === 'B' || runType === 'BOTH') setIsRunningB(true);
    if (runType === 'BOTH') setIsComparing(true);

    try {
      const benchmarkId = mode === 'presets' ? selectedPreset : roomId || 'custom';
      const fileA = { id: 'solA', name: getLanguageConfig(langA).defaultFileName, path: '/a', content: codeA };
      const fileB = { id: 'solB', name: getLanguageConfig(langB).defaultFileName, path: '/b', content: codeB };

      const res = await fetch('/api/v1/benchmark/run', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            benchmarkId,
            runType,
            langA,
            langB,
            filesA: [fileA],
            filesB: [fileB]
         })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Benchmark failed');

      if (data.resultA) setResultA(data.resultA);
      if (data.resultB) setResultB(data.resultB);

    } catch (err: any) {
      console.error(err);
      if (runType === 'A' || runType === 'BOTH') {
         setResultA({
          status: 'runtime_error',
          stdout: '',
          stderr: err?.message || 'Execution error in Code A',
          exitCode: 1,
          executionTimeMs: 0,
          memoryUsageMb: 0,
          timestamp: new Date().toISOString(),
          provider: 'cloud_sandbox',
        } as ExecutionResult);
      }
      if (runType === 'B' || runType === 'BOTH') {
         setResultB({
          status: 'runtime_error',
          stdout: '',
          stderr: err?.message || 'Execution error in Code B',
          exitCode: 1,
          executionTimeMs: 0,
          memoryUsageMb: 0,
          timestamp: new Date().toISOString(),
          provider: 'cloud_sandbox',
        } as ExecutionResult);
      }
    } finally {
      setIsRunningA(false);
      setIsRunningB(false);
      setIsComparing(false);
    }
  };'''

pattern = r'const handleRunBenchmark = async \(\) => \{.*?\n  \};'
content = re.sub(pattern, new_handle_run_benchmark, content, flags=re.DOTALL)

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
