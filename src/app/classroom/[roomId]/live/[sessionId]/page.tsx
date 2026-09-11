import { Suspense } from 'react';
import LiveClassroomClient from './LiveClassroomClient';

export default async function LiveClassroomPage({ params }: { params: Promise<{ roomId: string, sessionId: string }> }) {
  const resolvedParams = await params;
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Loading Live Classroom...</div>}>
      <LiveClassroomClient roomId={resolvedParams.roomId} sessionId={resolvedParams.sessionId} />
    </Suspense>
  );
}
