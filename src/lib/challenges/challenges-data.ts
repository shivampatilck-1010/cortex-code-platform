import { TestCase } from '../execution/types';
import { DSA_CHALLENGES } from './dsa-challenges';
import { PROGRAMMING_CHALLENGES } from './programming-challenges';
import { SQL_CHALLENGES } from './sql-challenges';

export type ChallengeTrack = 'Programming' | 'DSA' | 'SQL';
export type ChallengeTopicCategory = 'Algorithms' | 'Database' | 'Programming';
export type ChallengeLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Challenge {
  id: string;
  title: string;
  slug: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  track: ChallengeTrack;
  topicCategory: ChallengeTopicCategory;
  level: ChallengeLevel;
  category: string;
  tags: string[];
  companyTags: string[];
  description: string;
  constraints: string[];
  examples: {
    input: string;
    output: string;
    explanation?: string;
  }[];
  starterTemplates: Record<string, string>;
  testCases: TestCase[];
  hints: string[];
  acceptanceRate: string;
}

export function difficultyToLevel(difficulty: Challenge['difficulty']): ChallengeLevel {
  switch (difficulty) {
    case 'Easy':
      return 'Beginner';
    case 'Medium':
      return 'Intermediate';
    case 'Hard':
      return 'Advanced';
  }
}

export { DSA_CHALLENGES, PROGRAMMING_CHALLENGES, SQL_CHALLENGES };

export const CHALLENGES: Challenge[] = [
  ...DSA_CHALLENGES,
  ...PROGRAMMING_CHALLENGES,
  ...SQL_CHALLENGES,
];
