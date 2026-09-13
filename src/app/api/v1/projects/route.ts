import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { projectDb, Project, ProjectFile } from '@/lib/project/db';
import { SUPPORTED_LANGUAGES } from '@/config/languages';
import crypto from 'crypto';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const projects = await projectDb.listProjectsForUser(user.id);
    return NextResponse.json({ projects });
  } catch (err: any) {
    console.error('List projects error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, language } = body;
    if (!name || !language) {
      return NextResponse.json({ error: 'Missing name or language' }, { status: 400 });
    }

    const projectId = `proj_${crypto.randomUUID()}`;
    const newProject: Project = {
      id: projectId,
      ownerId: user.id,
      name,
      description: description || '',
      language,
      status: 'active',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await projectDb.createProject(newProject);

    // Create a default file based on language
    const langConfig = SUPPORTED_LANGUAGES.find(l => l.id === language);
    if (langConfig) {
      const mainFileId = `file_${crypto.randomUUID()}`;
      const newFile: ProjectFile = {
        id: mainFileId,
        projectId,
        name: langConfig.defaultFileName,
        path: `/${langConfig.defaultFileName}`,
        content: langConfig.starterCode || '',
        isFolder: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await projectDb.createFile(newFile);
    }

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (err: any) {
    console.error('Create project error:', err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
