'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function AssignmentDirectLaunchRedirect({
  params
}: {
  params?: Promise<{ roomId: string; asgId: string }>;
}) {
  const router = useRouter();
  const routeParams = useParams();

  useEffect(() => {
    const resolveAndRedirect = async () => {
      let rId = (routeParams?.roomId as string) || '';
      let aId = (routeParams?.asgId as string) || '';

      if (params) {
        if (typeof (params as any)?.then === 'function') {
          try {
            const p = await params;
            if (p?.roomId) rId = p.roomId;
            if (p?.asgId) aId = p.asgId;
          } catch (_) {}
        } else {
          const p = params as any;
          if (p?.roomId) rId = p.roomId;
          if (p?.asgId) aId = p.asgId;
        }
      }

      const search = typeof window !== 'undefined' ? window.location.search : '';
      router.replace(`/classroom/${rId}/assignments/${aId}/solve${search}`);
    };

    resolveAndRedirect();
  }, [params, routeParams, router]);

  return (
    <div className="min-h-screen bg-[#08080a] flex items-center justify-center text-gray-400 font-sans">
      Connecting to secure assignment workspace...
    </div>
  );
}
