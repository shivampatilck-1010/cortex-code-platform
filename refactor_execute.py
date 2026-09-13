import re
import os

def refactor_execute_api():
    path = 'src/app/api/v1/execute/route.ts'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Add imports
    imports = """import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { executeInCloudRunner } from '@/lib/execution/cloud-runner';"""
    content = re.sub(r'import \{ NextRequest, NextResponse \} from \'next/server\';\s*import \{ executeInCloudRunner \} from \'@/lib/execution/cloud-runner\';', imports, content)

    # Replace the body parsing and file logic
    body_logic = """
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Malformed JSON payload' }, { status: 400 });
    }

    const { projectId, language, stdin, args, version, entrypoint } = body || {};

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required for execution' }, { status: 400 });
    }

    // 2.5 Auth & Ownership Verification
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const project = await projectDb.getProjectById(projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }
    
    if (project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden: You do not own this project' }, { status: 403 });
    }

    const dbFiles = await projectDb.getProjectFiles(projectId);

    if (!language || typeof language !== 'string') {
      return NextResponse.json({ error: 'Language is required and must be a string' }, { status: 400 });
    }

    const normalizedLang = language.toLowerCase().trim();
    if (!ALLOWED_LANGUAGES.has(normalizedLang)) {
      return NextResponse.json(
        { error: `Language "${language}" is not supported or prohibited for execution.` },
        { status: 400 }
      );
    }

    const langConfig = getLanguageConfig(normalizedLang);

    // Normalize files from DB
    let rawFiles = dbFiles.map(f => ({
      id: f.id,
      name: f.name,
      path: f.path,
      content: f.content,
      isFolder: f.isFolder
    }));
    
    if (rawFiles.length === 0) {
      return NextResponse.json({ error: 'Project has no files' }, { status: 400 });
    }"""

    # We need to replace the old try block part
    old_try_block_regex = r'let body: any;\s*try \{[\s\S]*?rawFiles \=\s*\[[\s\S]*?\];\s*\}'
    content = re.sub(old_try_block_regex, body_logic, content)
    
    # Write back
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def refactor_engine_ts():
    path = 'src/lib/execution/engine.ts'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # We need to change ExecutionRequest type usage to include projectId and strip files from being sent, or we can just send projectId
    # Let's modify the engine to accept `projectId` in ExecutionRequest
    # Wait, types.ts needs projectId
    content = content.replace("export async function executeInCloudSandbox(req: ExecutionRequest): Promise<ExecutionResult> {",
                              "export async function executeInCloudSandbox(req: ExecutionRequest & { projectId?: string }): Promise<ExecutionResult> {")
    content = content.replace("files: req.files,", "projectId: req.projectId,\n        files: undefined,")

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

def refactor_page_tsx():
    path = 'src/app/page.tsx'
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Modify handleRun to trigger save first, and pass projectId
    # It currently does:
    # const res = await executeInCloudSandbox({
    #   language: currentLang.id,
    #   files: files.filter((f) => !f.isFolder),
    #   entrypoint: mainFile?.name || activeFile.name,
    #   stdin: customStdin,
    # });

    run_replacement = """
      // Force save active file before run
      if (projectId && activeFileId) {
         try {
           const currentContent = files.find(f => f.id === activeFileId)?.content || '';
           await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ content: currentContent })
           });
         } catch(e) {}
      }

      const res = await executeInCloudSandbox({
        projectId: projectId as string,
        language: currentLang.id,
        files: [], // Sent by backend now
        entrypoint: mainFile?.name || activeFile.name,
        stdin: customStdin,
      });"""
    content = re.sub(r'const res = await executeInCloudSandbox\(\{[\s\S]*?stdin: customStdin,\s*\}\);', run_replacement, content)
    
    # Similarly for runTestCases and benchmarkExecution
    # runTestCases:
    run_test_cases = """
      if (projectId && activeFileId) {
         try {
           const currentContent = files.find(f => f.id === activeFileId)?.content || '';
           await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ content: currentContent })
           });
         } catch(e) {}
      }

      const { testCases: evaluated, passedCount, totalCount } = await runTestCases(
        {
          projectId: projectId as string,
          language: currentLang.id,
          files: [],
          entrypoint: activeFile.name,
        },
        testCases
      );"""
    content = re.sub(r'const \{ testCases: evaluated, passedCount, totalCount \} = await runTestCases\(\s*\{[\s\S]*?entrypoint: activeFile\.name,\s*\},\s*testCases\s*\);', run_test_cases, content)

    benchmark = """
      if (projectId && activeFileId) {
         try {
           const currentContent = files.find(f => f.id === activeFileId)?.content || '';
           await fetch(`/api/v1/projects/${projectId}/files/${activeFileId}`, {
             method: 'PATCH',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ content: currentContent })
           });
         } catch(e) {}
      }

      const res = await benchmarkExecution({
        projectId: projectId as string,
        language: currentLang.id,
        files: [],
        entrypoint: activeFile.name,
      });"""
    content = re.sub(r'const res = await benchmarkExecution\(\{[\s\S]*?entrypoint: activeFile\.name,\s*\}\);', benchmark, content)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

if __name__ == '__main__':
    refactor_execute_api()
    refactor_engine_ts()
    refactor_page_tsx()
