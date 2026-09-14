import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb } from '@/lib/project/db';
import { unzipSync, strFromU8 } from 'fflate';

export const runtime = 'edge';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const { id } = await params;
    const project = await projectDb.getProject(id);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    if (project.ownerId !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Get formData
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    
    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      return NextResponse.json({ error: 'File too large' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const zipData = new Uint8Array(arrayBuffer);
    
    let unzipped: Record<string, Uint8Array>;
    try {
       unzipped = unzipSync(zipData);
    } catch(e) {
       return NextResponse.json({ error: 'Invalid ZIP file' }, { status: 400 });
    }

    const filesToCreate: Array<any> = [];

    for (const [filename, dataObj] of Object.entries(unzipped)) {
      const data = dataObj as Uint8Array;
      // Skip directories or hidden files
      if (data.length === 0 && filename.endsWith('/')) continue;
      if (filename.includes('__MACOSX') || filename.includes('.DS_Store')) continue;
      if (filename.startsWith('.') || filename.includes('/.')) continue;
      
      const content = strFromU8(data);
      const isFolder = false;
      const path = '/' + filename;

      filesToCreate.push({
        id: `f_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        projectId: id,
        name: filename.split('/').pop() || filename,
        path: path,
        content: content,
        isFolder: isFolder,
      });
    }

    // Save all to database (this overrides existing files with the same path, or just adds them)
    // Actually, to be safe, let's delete existing project files and insert the new ones.
    const existingFiles = await projectDb.listFilesForProject(id);
    
    for (const ef of existingFiles) {
      await projectDb.deleteFile(ef.id);
    }

    const newFiles: any[] = [];
    for (const nf of filesToCreate) {
      const created = await projectDb.createFile(nf);
      newFiles.push(created);
    }

    return NextResponse.json({ success: true, files: newFiles });
  } catch (error: any) {
    console.error('Project import error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
