import { NextRequest, NextResponse } from 'next/server';
import { classroomDb } from '@/lib/classroom/db';
import { ClassroomAuth } from '@/lib/classroom/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const notifications = await classroomDb.listNotificationsForUser(user.id, limit);
    const unreadCount = notifications.filter((n) => !n.readAt).length;
    return NextResponse.json({ notifications, unreadCount });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to fetch notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return handleMarkRead(req);
}

export async function PUT(req: NextRequest) {
  return handleMarkRead(req);
}

async function handleMarkRead(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json().catch(() => ({}));

    if (body.markAll || body.markAllRead) {
      await classroomDb.markAllNotificationsRead(user.id);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    const notifId = body.id || body.notificationId;
    if (notifId) {
      await classroomDb.markNotificationRead(String(notifId), user.id);
      return NextResponse.json({ success: true, message: 'Notification marked as read' });
    }

    return NextResponse.json({ error: 'Missing markAll or notification id' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to update notifications' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const url = new URL(req.url);
    const queryId = url.searchParams.get('id');
    const queryClearAll = url.searchParams.get('clearAll') === 'true';

    let body: any = {};
    try {
      body = await req.json();
    } catch {}

    const shouldClearAll = queryClearAll || body.clearAll;
    if (shouldClearAll) {
      await classroomDb.clearAllNotifications(user.id);
      return NextResponse.json({ success: true, message: 'All notifications cleared' });
    }

    const targetId = queryId || body.id || body.notificationId;
    if (targetId) {
      const deleted = await classroomDb.deleteNotification(String(targetId), user.id);
      return NextResponse.json({ success: deleted, message: deleted ? 'Notification deleted' : 'Notification not found' });
    }

    return NextResponse.json({ error: 'Missing notification id or clearAll parameter' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to delete notification' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await ClassroomAuth.authenticateRequest(req);
    if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    const body = await req.json();

    const { targetUserId, classroomId, type, title, message, data } = body;
    if (!classroomId || !title || !message) {
      return NextResponse.json({ error: 'Missing required notification fields' }, { status: 400 });
    }

    const recipientUserId = targetUserId || user.id;
    const notification = await classroomDb.createNotification({
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: recipientUserId,
      classroomId,
      type: type || 'system',
      title,
      message,
      data: data || undefined,
      createdAt: Date.now(),
    });

    return NextResponse.json({ success: true, notification }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to create notification' }, { status: 500 });
  }
}
