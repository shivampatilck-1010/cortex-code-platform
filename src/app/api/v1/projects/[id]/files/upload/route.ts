import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb, ProjectFile } from '@/lib/project/db';
import { unzipSync, strFromU8 } from 'fflate';
import crypto from 'crypto';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 512 * 1024; // 512 KB per file
const MAX_PROJECT_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB total

function sanitizeRelativePath(rawPath: string): string {
  // Normalize slashes, remove leading slashes, reject directory traversal
  const normalized = rawPath.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.includes('..') || normalized.includes('\0')) {
    throw new Error(`Unsafe path traversal detected: ${rawPath}`);
  }
  return normalized;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const project = await projectDb.getProject(projectId);
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    if (project.ownerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return NextResponse.json({ error: 'Invalid multipart form data' }, { status: 400 });
    }

    const filesToProcess: Array<{ path: string; content: string }> = [];
    let totalBytes = 0;

    for (const [key, value] of formData.entries()) {
      if (typeof value === 'object' && value !== null && 'arrayBuffer' in value) {
        const fileObj = value as File;
        const fileName = fileObj.name;
        const relativePath = (value as any).webkitRelativePath || fileName;
        const buffer = await fileObj.arrayBuffer();

        totalBytes += buffer.byteLength;
        if (totalBytes > MAX_PROJECT_UPLOAD_SIZE) {
          return NextResponse.json(
            { error: 'Total upload size exceeds 10 MB limit' },
            { status: 400 }
          );
        }

        // If it's a zip archive, unzip in memory
        if (fileName.toLowerCase().endsWith('.zip')) {
          try {
            const unzipped = unzipSync(new Uint8Array(buffer));
            for (const [innerPath, contentBytes] of Object.entries(unzipped)) {
              // Ignore OS metadata and directories
              if (
                innerPath.endsWith('/') ||
                innerPath.startsWith('__MACOSX') ||
                innerPath.includes('.DS_Store')
              ) {
                continue;
              }

              if (contentBytes.byteLength > MAX_FILE_SIZE) {
                continue; // Skip oversized single files inside archive
              }

              const safeInnerPath = sanitizeRelativePath(innerPath);
              const textContent = strFromU8(contentBytes);
              filesToProcess.push({
                path: safeInnerPath,
                content: textContent,
              });
            }
          } catch (zipErr: any) {
            return NextResponse.json(
              { error: `Corrupted ZIP archive: ${zipErr.message}` },
              { status: 400 }
            );
          }
        } else {
          // Regular file
          if (buffer.byteLength > MAX_FILE_SIZE) {
            return NextResponse.json(
              { error: `File "${fileName}" exceeds 512 KB size limit` },
              { status: 400 }
            );
          }

          let safePath: string;
          try {
            safePath = sanitizeRelativePath(relativePath);
          } catch (pathErr: any) {
            return NextResponse.json(
              { error: pathErr.message || 'Unsafe path traversal detected' },
              { status: 400 }
            );
          }
          const textContent = new TextDecoder('utf-8', { fatal: false }).decode(buffer);
          filesToProcess.push({
            path: safePath,
            content: textContent,
          });
        }
      }
    }

    if (filesToProcess.length === 0) {
      return NextResponse.json({ error: 'No valid files received in upload' }, { status: 400 });
    }

    // Get existing files in project
    const existingFiles = await projectDb.listFilesForProject(projectId);
    const existingByPath = new Map<string, ProjectFile>();
    existingFiles.forEach(f => existingByPath.set(f.path.replace(/^\/+/, ''), f));

    const createdOrUpdated: ProjectFile[] = [];

    // Ensure parent folders exist
    for (const item of filesToProcess) {
      const parts = item.path.split('/');
      let currentFolder = '';
      for (let i = 0; i < parts.length - 1; i++) {
        currentFolder = currentFolder ? `${currentFolder}/${parts[i]}` : parts[i];
        if (!existingByPath.has(currentFolder)) {
          const folderFile: ProjectFile = {
            id: `fold_${crypto.randomUUID()}`,
            projectId,
            name: parts[i],
            path: `/${currentFolder}`,
            content: '',
            isFolder: true,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await projectDb.createFile(folderFile);
          existingByPath.set(currentFolder, folderFile);
          createdOrUpdated.push(folderFile);
        }
      }

      const fileName = parts[parts.length - 1];
      const normalizedPath = `/${item.path}`;
      const existing = existingByPath.get(item.path);

      if (existing) {
        // Snapshot old version before updating
        if (existing.content !== item.content) {
          await projectDb.createFileVersion(existing.id, projectId, existing.content);
        }
        const updated = await projectDb.updateFile(existing.id, {
          content: item.content,
        });
        if (updated) createdOrUpdated.push(updated);
      } else {
        const newFile: ProjectFile = {
          id: `file_${crypto.randomUUID()}`,
          projectId,
          name: fileName,
          path: normalizedPath,
          content: item.content,
          isFolder: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await projectDb.createFile(newFile);
        existingByPath.set(item.path, newFile);
        createdOrUpdated.push(newFile);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${createdOrUpdated.length} files and directories`,
      files: createdOrUpdated,
    });
  } catch (err: any) {
    console.error('[Upload Files Route Error]', err);
    if (err.message && err.message.includes('Unsafe path traversal detected')) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
