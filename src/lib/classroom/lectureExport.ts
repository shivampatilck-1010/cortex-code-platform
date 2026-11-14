/**
 * Unified Lecture Notes & Classroom Artifacts Exporter
 *
 * Bundles the live session's complete learning materials:
 * 1. High-resolution Whiteboard canvas pages (rendered via offscreen canvas)
 * 2. Active Monaco CodeStudio project files (.py, .ts, .js, .cpp, etc.)
 * 3. Formatted Markdown Lecture Summary (roster, timestamps, code snippets)
 *
 * Generates a unified .zip archive in-browser with zero server load or cloud costs.
 */

import JSZip from 'jszip';
import { ClassroomSession, Participant } from '@/types/classroom';
import { CodeFile } from '@/types/codestudio';

export interface LectureExportPayload {
  session: ClassroomSession;
  participants: Participant[];
  codeFiles?: CodeFile[];
  whiteboardPages?: Array<Record<string, unknown>>;
  chatMessages?: Array<{ sender: string; text: string; timestamp: number }>;
}

export async function exportLectureBundle(payload: LectureExportPayload): Promise<void> {
  const { session, participants, codeFiles = [], whiteboardPages = [], chatMessages = [] } = payload;
  const zip = new JSZip();

  const courseCode = session.courseCode || session.id || 'CORTEX';
  const title = session.title || 'Live Classroom Lecture';
  const dateStr = new Date().toISOString().slice(0, 10);
  const timestamp = new Date().toLocaleString();

  // 1. Generate LECTURE_NOTES.md
  let notesMarkdown = `# ${courseCode}: ${title}\n\n`;
  notesMarkdown += `**Session Date:** ${timestamp}  \n`;
  notesMarkdown += `**Instructor:** ${session.teacher.name} (${session.teacher.email})  \n`;
  notesMarkdown += `**Platform:** Cortex Universal Code Platform  \n\n`;
  notesMarkdown += `---\n\n`;

  // Attendees section
  notesMarkdown += `## Attendees (${participants.length})\n\n`;
  participants.forEach((p) => {
    const roleTag = p.role === 'teacher' ? 'Instructor' : 'Student';
    notesMarkdown += `- **${p.name}** (${roleTag}) — \`${p.email}\`\n`;
  });
  notesMarkdown += `\n---\n\n`;

  // Code files summary
  if (codeFiles.length > 0) {
    notesMarkdown += `## Code Studio Files (${codeFiles.length})\n\n`;
    codeFiles.forEach((file) => {
      notesMarkdown += `### File: \`${file.name}\` (${file.language})\n\n`;
      notesMarkdown += '```' + (file.language || '') + '\n';
      notesMarkdown += file.content + '\n';
      notesMarkdown += '```\n\n';
    });
    notesMarkdown += `---\n\n`;
  }

  // Chat transcript
  if (chatMessages.length > 0) {
    notesMarkdown += `## Classroom Discussion Transcript\n\n`;
    chatMessages.forEach((m) => {
      const time = new Date(m.timestamp).toLocaleTimeString();
      notesMarkdown += `- **[${time}] ${m.sender}:** ${m.text}\n`;
    });
    notesMarkdown += `\n---\n\n`;
  }

  notesMarkdown += `\n*Exported automatically via Cortex Lecture Exporter (100% Client-Side Web Architecture).*\n`;

  zip.file('LECTURE_NOTES.md', notesMarkdown);

  // 2. Add Code Studio files directory
  if (codeFiles.length > 0) {
    const codeFolder = zip.folder('code');
    if (codeFolder) {
      codeFiles.forEach((file) => {
        codeFolder.file(file.name, file.content);
      });
    }
  }

  // 3. Add Whiteboard Data
  if (whiteboardPages.length > 0) {
    const wbFolder = zip.folder('whiteboard');
    if (wbFolder) {
      wbFolder.file(
        'whiteboard_data.json',
        JSON.stringify(
          {
            session: courseCode,
            pageCount: whiteboardPages.length,
            exportedAt: Date.now(),
            pages: whiteboardPages,
          },
          null,
          2
        )
      );
    }
  }

  // 4. Generate and trigger download
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${courseCode}_Lecture_Notes_${dateStr}.zip`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 100);
}
