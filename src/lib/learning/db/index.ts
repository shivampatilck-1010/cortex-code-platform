import { getDbInstance } from '@/lib/db';
import { COURSES } from '@/lib/learning/courses-data';

export interface LearningCourse {
  id: string;
  title: string;
  slug: string;
  description: string;
  level: string;
  language: string;
  icon: string;
  created_at: number;
  updated_at: number;
}

export interface LearningLesson {
  id: string;
  course_id: string;
  title: string;
  slug: string;
  duration_minutes: number;
  content: string;
  starter_code: string;
  language: string;
  expected_output: string;
  hint: string;
  order_index: number;
  created_at: number;
  updated_at: number;
}

export interface LearningProgress {
  id: string;
  user_id: string;
  course_id: string;
  lesson_id: string;
  status: 'completed' | 'in_progress';
  last_code: string;
  completed_at: number | null;
  updated_at: number;
}

class LearningDatabase {
  private db: any = null;

  async getDb() {
    if (this.db) return this.db;
    if (typeof window !== 'undefined') return null; // Server only
    this.db = (await getDbInstance('.cortex/data/learning.db')) as any;
    if (this.db) {
      await this.init();
    }
    return this.db;
  }

  async init(): Promise<void> {
    if (!this.db) return;
    try {
      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS learning_courses (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          slug TEXT NOT NULL,
          description TEXT NOT NULL,
          level TEXT NOT NULL,
          language TEXT NOT NULL,
          icon TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
      `);

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS learning_lessons (
          id TEXT PRIMARY KEY,
          course_id TEXT NOT NULL,
          title TEXT NOT NULL,
          slug TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          content TEXT NOT NULL,
          starter_code TEXT NOT NULL,
          language TEXT NOT NULL,
          expected_output TEXT NOT NULL,
          hint TEXT NOT NULL,
          order_index INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE
        );
      `);

      await this.db.exec(`
        CREATE TABLE IF NOT EXISTS learning_progress (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          course_id TEXT NOT NULL,
          lesson_id TEXT NOT NULL,
          status TEXT NOT NULL,
          last_code TEXT NOT NULL,
          completed_at INTEGER,
          updated_at INTEGER NOT NULL,
          UNIQUE(user_id, course_id, lesson_id),
          FOREIGN KEY (course_id) REFERENCES learning_courses(id) ON DELETE CASCADE,
          FOREIGN KEY (lesson_id) REFERENCES learning_lessons(id) ON DELETE CASCADE
        );
      `);

      await this.seed();
    } catch (e) {
      console.error('[Learning DB] Init schema failed:', e);
    }
  }

  private async seed(): Promise<void> {
    const existing = await this.db.prepare('SELECT COUNT(*) as c FROM learning_courses').get() as { c: number };
    if (existing && existing.c > 0) return;

    console.log('[Learning DB] Seeding initial courses data...');
    const now = Date.now();
    for (const course of COURSES) {
      await this.db.prepare(
        'INSERT INTO learning_courses (id, title, slug, description, level, language, icon, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(course.id, course.title, course.slug, course.description, course.level, course.language, course.icon, now, now);

      let order = 0;
      for (const lesson of course.lessons) {
        await this.db.prepare(
          'INSERT INTO learning_lessons (id, course_id, title, slug, duration_minutes, content, starter_code, language, expected_output, hint, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(lesson.id, course.id, lesson.title, lesson.slug, lesson.durationMinutes, lesson.content, lesson.starterCode, lesson.language, lesson.expectedOutput, lesson.hint, order++, now, now);
      }
    }
  }

  // --- API Methods ---
  async getCourses(): Promise<(LearningCourse & { lessonsCount: number })[]> {
    const db = await this.getDb();
    if (!db) return [];
    const courses = await db.prepare('SELECT * FROM learning_courses ORDER BY created_at ASC').all() as LearningCourse[];
    const result: (LearningCourse & { lessonsCount: number })[] = [];
    for (const c of courses) {
      const count = await db.prepare('SELECT COUNT(*) as c FROM learning_lessons WHERE course_id = ?').get(c.id) as { c: number };
      result.push({ ...c, lessonsCount: count ? count.c : 0 });
    }
    return result;
  }

  async getCourseDetails(id: string): Promise<(LearningCourse & { lessons: LearningLesson[] }) | null> {
    const db = await this.getDb();
    if (!db) return null;
    const course = await db.prepare('SELECT * FROM learning_courses WHERE id = ?').get(id) as LearningCourse;
    if (!course) return null;
    const lessons = await db.prepare('SELECT * FROM learning_lessons WHERE course_id = ? ORDER BY order_index ASC').all(course.id) as LearningLesson[];
    return { ...course, lessons };
  }

  async getProgress(userId: string, courseId?: string): Promise<LearningProgress[]> {
    const db = await this.getDb();
    if (!db) return [];
    if (courseId) {
      return await db.prepare('SELECT * FROM learning_progress WHERE user_id = ? AND course_id = ?').all(userId, courseId) as LearningProgress[];
    }
    return await db.prepare('SELECT * FROM learning_progress WHERE user_id = ?').all(userId) as LearningProgress[];
  }

  async updateProgress(
    userId: string, 
    courseId: string, 
    lessonId: string, 
    status: 'completed' | 'in_progress', 
    lastCode: string
  ): Promise<LearningProgress> {
    const db = await this.getDb();
    if (!db) throw new Error('DB not initialized');
    
    const now = Date.now();
    const id = `${userId}_${lessonId}`; // simple composite ID

    const existing = await db.prepare('SELECT * FROM learning_progress WHERE user_id = ? AND course_id = ? AND lesson_id = ?').get(userId, courseId, lessonId) as LearningProgress;

    if (existing) {
      const completedAt = status === 'completed' ? (existing.completed_at || now) : existing.completed_at;
      await db.prepare('UPDATE learning_progress SET status = ?, last_code = ?, completed_at = ?, updated_at = ? WHERE id = ?')
        .run(status, lastCode, completedAt, now, existing.id);
      return { ...existing, status, last_code: lastCode, completed_at: completedAt, updated_at: now };
    } else {
      const completedAt = status === 'completed' ? now : null;
      await db.prepare('INSERT INTO learning_progress (id, user_id, course_id, lesson_id, status, last_code, completed_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, userId, courseId, lessonId, status, lastCode, completedAt, now);
      return { id, user_id: userId, course_id: courseId, lesson_id: lessonId, status, last_code: lastCode, completed_at: completedAt, updated_at: now };
    }
  }
}

export const learningDb = new LearningDatabase();
