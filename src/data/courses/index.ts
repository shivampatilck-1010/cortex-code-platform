import type {
  Course,
  CourseCategory,
  CourseModule,
  CourseTrack,
  LessonItem,
} from '@/types/learn';
import { pythonDsaCourse } from './python-dsa';
import { cppSystemsCourse } from './cpp-systems';
import { sqlDesignCourse } from './sql-design';
import { extendedCourses } from './extended-courses';

export const COURSE_TRACKS: readonly ['All Tracks', ...CourseTrack[]] = [
  'All Tracks',
  'Python & DSA',
  'Systems & C++',
  'SQL & Data',
  'AI & ML',
] as const;

export const COURSE_CATEGORIES: readonly ['All Courses', ...CourseCategory[]] = [
  'All Courses',
  'Data Structures',
  'Programming',
  'Machine Learning',
  'Data Science',
  'Web Development',
  'Databases & SQL',
  'Cyber Security',
  'Systems & C++',
] as const;

export const COURSES: Course[] = [
  pythonDsaCourse,
  ...extendedCourses,
  cppSystemsCourse,
  sqlDesignCourse,
];

export function getCourseByIdOrSlug(idOrSlug: string): Course | undefined {
  const normalized = idOrSlug.trim();
  if (!normalized) {
    return undefined;
  }
  return COURSES.find(
    (course) => course.id === normalized || course.slug === normalized
  );
}

export function flattenCourseLessons(course: Course): LessonItem[] {
  return course.modules.flatMap((mod) => mod.items);
}

export function findLessonInCourse(
  course: Course,
  lessonId: string
):
  | {
      module: CourseModule;
      moduleIndex: number;
      item: LessonItem;
      flatIndex: number;
    }
  | undefined {
  const normalized = lessonId.trim();
  if (!normalized) {
    return undefined;
  }

  let flatIndex = 0;
  for (let moduleIndex = 0; moduleIndex < course.modules.length; moduleIndex++) {
    const mod = course.modules[moduleIndex];
    for (const item of mod.items) {
      if (item.id === normalized) {
        return {
          module: mod,
          moduleIndex,
          item,
          flatIndex,
        };
      }
      flatIndex++;
    }
  }

  return undefined;
}

export function getCourseStats(course: Course): {
  moduleCount: number;
  notesCount: number;
  quizCount: number;
  labCount: number;
  examCount: number;
  totalItems: number;
} {
  let notesCount = 0;
  let quizCount = 0;
  let labCount = 0;
  let examCount = 0;

  for (const mod of course.modules) {
    for (const item of mod.items) {
      switch (item.type) {
        case 'notes':
          notesCount++;
          break;
        case 'quiz':
          quizCount++;
          break;
        case 'lab':
          labCount++;
          break;
        case 'exam':
          examCount++;
          break;
      }
    }
  }

  return {
    moduleCount: course.modules.length,
    notesCount,
    quizCount,
    labCount,
    examCount,
    totalItems: notesCount + quizCount + labCount + examCount,
  };
}
