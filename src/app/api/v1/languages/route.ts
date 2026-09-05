import { NextResponse } from 'next/server';
import { SUPPORTED_LANGUAGES } from '@/config/languages';

export async function GET() {
  const languages = SUPPORTED_LANGUAGES.map((l) => ({
    id: l.id,
    name: l.name,
    version: l.version,
    compiler: l.compiler,
    fileExtension: l.fileExtension,
    defaultFileName: l.defaultFileName,
    category: l.category,
    timeoutSec: l.timeoutSec,
    memoryLimitMb: l.memoryLimitMb,
    debuggerSupported: l.debuggerSupported,
  }));

  return NextResponse.json({
    count: languages.length,
    languages,
  });
}
