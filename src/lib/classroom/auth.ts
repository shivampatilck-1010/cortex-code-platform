import { NextRequest } from 'next/server';
import { User, ClassroomMemberRole } from './models';
import { classroomDb } from './db';

export interface AuthContext {
  user: User;
  classroomId?: string;
  membership?: {
    role: ClassroomMemberRole;
    status: 'active' | 'dropped';
  };
  isTeacher: boolean;
  isAdmin: boolean;
}

export class ClassroomAuth {
  static getCurrentUser(req: NextRequest): User {
    const userId = req.headers.get('x-user-id') || req.cookies.get('cortex_user_id')?.value || 'usr_prof_elena';
    const userRole = (req.headers.get('x-user-role') || req.cookies.get('cortex_user_role')?.value || 'teacher') as any;
    const userName = req.headers.get('x-user-name') || req.cookies.get('cortex_user_name')?.value || 'Prof. Elena Rostova';
    const userEmail = req.headers.get('x-user-email') || req.cookies.get('cortex_user_email')?.value || 'elena.rostova@cortex.edu';

    let user = classroomDb.getUser(userId);
    if (!user) {
      user = classroomDb.createUser({
        id: userId,
        name: userName,
        email: userEmail,
        role: userRole,
        status: 'active',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return user;
  }

  static verifyAccess(
    req: NextRequest,
    classroomId?: string,
    requiredRole?: 'teacher' | 'student' | 'admin'
  ): { authorized: boolean; error?: string; context?: AuthContext } {
    const user = this.getCurrentUser(req);
    const isAdmin = user.role === 'admin';

    let membership: any = undefined;
    let isTeacher = false;

    if (isAdmin) {
      isTeacher = true;
    } else if (classroomId) {
      const classroom = classroomDb.getClassroom(classroomId);
      if (!classroom) {
        return { authorized: false, error: 'Classroom not found' };
      }

      if (classroom.teacherId === user.id) {
        isTeacher = true;
      }

      const mem = classroomDb.getMember(classroomId, user.id);
      if (mem && mem.status === 'active') {
        membership = {
          role: mem.role,
          status: mem.status,
        };
        if (mem.role === 'teacher' || mem.role === 'ta') {
          isTeacher = true;
        }
      }

      // If user is not an instructor, verify they are an active member
      if (!isTeacher && (!mem || mem.status !== 'active')) {
        return {
          authorized: false,
          error: 'You do not have access to this classroom.',
        };
      }
    } else {
      isTeacher = user.role === 'teacher';
    }

    if (requiredRole === 'teacher' && !isTeacher) {
      return {
        authorized: false,
        error: 'Teacher privileges required for this action.',
      };
    }

    if (requiredRole === 'admin' && !isAdmin) {
      return {
        authorized: false,
        error: 'Administrator privileges required.',
      };
    }

    return {
      authorized: true,
      context: {
        user,
        classroomId,
        membership,
        isTeacher,
        isAdmin,
      },
    };
  }
}
