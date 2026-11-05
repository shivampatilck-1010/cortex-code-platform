import { NextRequest, NextResponse } from 'next/server';
import { ClassroomAuth } from '@/lib/classroom/auth';
import { signDeviceTrustToken } from '@/lib/lockdown/security-policy';

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.getCurrentUser(req);
    if (!user || !user.id) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await req.json();
    const { hardwareFingerprint, deviceModel, osVersion, arch, displayCount, clientBinaryHash } = body;

    if (!hardwareFingerprint) {
      return NextResponse.json({ error: 'hardwareFingerprint is required' }, { status: 400 });
    }

    const platform = req.headers.get('x-cortex-client-platform') || 'windows';
    const deviceId = `dev_${platform.substring(0, 3)}_${Math.random().toString(36).substring(2, 10)}`;

    const deviceTrustToken = signDeviceTrustToken(deviceId, user.id, hardwareFingerprint);

    return NextResponse.json({
      success: true,
      deviceId,
      deviceTrustToken,
      registeredAt: Date.now(),
      status: 'trusted',
      deviceModel: deviceModel || 'Standard Desktop',
      osVersion: osVersion || 'Windows 11',
      displayCount: displayCount || 1,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Device enrollment failed' }, { status: 500 });
  }
}
