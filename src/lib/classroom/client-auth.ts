export interface ClassroomClientIdentity {
  id: string;
  name: string;
  email?: string;
  role: string;
}

export function getClassroomAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') {
    return { 'Content-Type': 'application/json' };
  }

  try {
    const stored = window.localStorage.getItem('cortex_user');
    const user = stored ? JSON.parse(stored) as ClassroomClientIdentity : null;
    if (!user?.id) {
      return { 'Content-Type': 'application/json' };
    }
    return {
      'Content-Type': 'application/json',
      'x-user-id': user.id,
      'x-user-role': user.role || 'student',
      'x-user-name': user.name || user.id,
      'x-user-email': user.email || `${user.id}@cortex.edu`,
    };
  } catch {
    return { 'Content-Type': 'application/json' };
  }
}
