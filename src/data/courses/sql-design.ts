import type { Course } from '@/types/learn';

export const sqlDesignCourse: Course = {
  id: 'sql-design',
  slug: 'sql-relational-design',
  title: 'SQL & Relational Query Design',
  track: 'SQL & Data',
  category: 'Databases & SQL',
  level: 'Beginner',
  description:
    'Design relational queries with confidence: combine INNER and LEFT JOINs, filter grouped aggregates with WHERE vs. HAVING, and rank rows using SQLite 3 window functions.',
  estimatedHours: 4,
  instructor: 'Marcus Vance',
  instructorInit: 'MV',
  featured: true,
  following: true,
  popularity: 94,
  publishedOrder: 3,
  poster: {
    gradient: 'from-[#171E22] via-[#1B2830] to-[#0E1317]',
    accentHex: '#F3912E',
    badge: 'SQLITE 3 · RELATIONAL',
    kicker: 'JOINS & WINDOWING',
    headline: 'Relational Query Craft',
    codeSnippet: 'RANK() OVER (ORDER BY salary DESC)',
    motif: 'sql',
  },
  attribution: {
    sourceName: 'Adapted from SQLite Documentation & OpenStax',
    sourceUrl: 'https://www.sqlite.org/docs.html',
    license: 'Public Domain / CC-BY-4.0',
  },
  modules: [
    {
      id: 'sql-mod-joins-windows',
      title: 'Joins, Aggregations & Window Functions',
      summary:
        'Combine normalized tables with INNER/LEFT JOIN, distinguish WHERE from HAVING, and compute rankings or running totals with OVER().',
      items: [
        {
          id: 'sql-m1-notes',
          type: 'notes',
          title: 'Relational Joins, Grouping & Window Functions',
          readMins: 9,
          tldr: [
            '`INNER JOIN` keeps only matching rows across both tables; `LEFT JOIN` preserves every left-table row and fills unmatched right-table columns with `NULL`.',
            '`WHERE` filters individual rows before `GROUP BY`; `HAVING` filters whole groups after aggregation.',
            'Window functions (`SUM(...) OVER (...)`, `RANK() OVER (...)`) compute aggregates or rankings without collapsing individual rows.',
          ],
          sections: [
            {
              id: 'inner-and-left-joins',
              heading: 'INNER JOIN vs. LEFT JOIN and the NULL Trap',
              paragraphs: [
                'Normalized schemas split entities across tables linked by foreign keys (for example, `employees.dept_id -> departments.id`). An `INNER JOIN` emits pairs only where the join predicate matches on both sides.',
                'A `LEFT JOIN` guarantees every row from the left table appears at least once in the intermediate result, with `NULL` values in the right-table columns when no match exists. Be careful when combining `LEFT JOIN` with `WHERE`: adding `WHERE right_table.col = "X"` discards the unmatched `NULL` rows and silently converts your `LEFT JOIN` into an `INNER JOIN`.',
              ],
              callout: {
                kind: 'pitfall',
                title: 'Filter Right-Table Conditions Inside ON for LEFT JOIN',
                body: 'If you want all departments plus only active employees in each department, place `AND e.status = \'active\'` inside the `LEFT JOIN ... ON` clause rather than in `WHERE`.',
              },
            },
            {
              id: 'grouping-and-having',
              heading: 'Logical Execution Order: WHERE vs. GROUP BY vs. HAVING',
              paragraphs: [
                'Although `SELECT` is written first, SQL executes logically in a strict pipeline: `FROM / JOIN` -> `WHERE` -> `GROUP BY` -> `HAVING` -> `SELECT` (including window functions) -> `ORDER BY`.',
                'Because `WHERE` runs before grouping, it cannot reference aggregate functions like `COUNT(*)` or `SUM(salary)`. Use `WHERE` to exclude raw input rows early, and use `HAVING` to filter collapsed groups after `GROUP BY` completes.',
              ],
              table: {
                headers: ['Clause', 'Runs On', 'Can Reference Aggregates?', 'Typical Purpose'],
                rows: [
                  ['FROM / JOIN', 'Base tables', 'No', 'Combine rows via key predicates'],
                  ['WHERE', 'Individual rows', 'No', 'Drop rows before grouping'],
                  ['GROUP BY', 'Filtered rows', 'Creates groups', 'Collapse rows by key columns'],
                  ['HAVING', 'Grouped buckets', 'Yes', 'Keep groups meeting aggregate criteria'],
                  ['OVER (...)', 'Window partitions', 'Yes (in SELECT)', 'Running totals, ranks without collapsing'],
                ],
              },
            },
            {
              id: 'window-functions',
              heading: 'Window Functions with PARTITION BY and ORDER BY',
              paragraphs: [
                'Aggregate queries with `GROUP BY` collapse N rows into 1 row per group. Window functions keep all N rows intact while computing a value across a related frame defined by `OVER (PARTITION BY ... ORDER BY ...)`.',
                'You can even combine `GROUP BY` and a window function in the same query: SQL computes the grouped `SUM(salary)` first, and then `RANK() OVER (ORDER BY SUM(salary) DESC)` ranks the resulting department summary rows.',
              ],
              callout: {
                kind: 'tip',
                title: 'ROW_NUMBER vs. RANK vs. DENSE_RANK',
                body: '`ROW_NUMBER()` always assigns 1, 2, 3 even on ties; `RANK()` leaves gaps after ties (1, 1, 3); `DENSE_RANK()` keeps consecutive numbers (1, 1, 2).',
              },
              codeBlock: {
                filename: 'joins_and_windows.sql',
                language: 'sql',
                runnableInIde: true,
                code: `DROP TABLE IF EXISTS emp_demo;
DROP TABLE IF EXISTS dept_demo;

CREATE TABLE dept_demo (
  id INTEGER PRIMARY KEY,
  dept_name TEXT NOT NULL
);

CREATE TABLE emp_demo (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  salary INTEGER NOT NULL
);

INSERT INTO dept_demo (id, dept_name) VALUES
  (1, 'Engineering'),
  (2, 'Product'),
  (3, 'Research');

INSERT INTO emp_demo (id, name, dept_id, salary) VALUES
  (1, 'Ada', 1, 150000),
  (2, 'Linus', 1, 135000),
  (3, 'Grace', 2, 125000);

SELECT
  d.dept_name,
  COUNT(e.id) AS headcount,
  COALESCE(SUM(e.salary), 0) AS total_salary,
  RANK() OVER (ORDER BY COALESCE(SUM(e.salary), 0) DESC) AS payroll_rank
FROM dept_demo d
LEFT JOIN emp_demo e ON e.dept_id = d.id
GROUP BY d.id, d.dept_name
ORDER BY payroll_rank ASC, d.dept_name ASC;
`,
              },
            },
          ],
          keyTakeaways: [
            'Use `LEFT JOIN` with `COALESCE` when unmatched parent rows must remain visible.',
            'Filter raw rows in `WHERE` before grouping and filter aggregate metrics in `HAVING` after `GROUP BY`.',
            'Window functions execute after `GROUP BY` and `HAVING`, letting you rank or compute running totals across grouped results.',
          ],
        },
        {
          id: 'sql-m1-quiz',
          type: 'quiz',
          title: 'Concept Check: Joins, Grouping & Windows',
          passScore: 75,
          questions: [
            {
              id: 'sql-q1',
              prompt: 'Which clause filters rows BEFORE `GROUP BY` forms buckets?',
              options: ['HAVING', 'WHERE', 'ORDER BY', 'OVER'],
              correctIndex: 1,
              explanation:
                '`WHERE` filters individual input rows prior to `GROUP BY`, whereas `HAVING` filters groups after aggregation.',
            },
            {
              id: 'sql-q2',
              prompt: 'Why does the query below omit departments with zero employees despite using `LEFT JOIN`?',
              codeSnippet: {
                language: 'sql',
                code: `SELECT d.dept_name, e.name
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
WHERE e.salary > 50000;`,
              },
              options: [
                'SQLite treats LEFT JOIN identically to INNER JOIN.',
                'Unmatched rows have `e.salary IS NULL`, and `NULL > 50000` is false/unknown in `WHERE`.',
                'GROUP BY is required before WHERE.',
                'LEFT JOIN only returns the first matching row.',
              ],
              correctIndex: 1,
              explanation:
                'Filtering `e.salary > 50000` in `WHERE` rejects every unmatched department row where `e.salary` is `NULL`. Moving the filter into `ON` preserves unmatched rows.',
            },
            {
              id: 'sql-q3',
              prompt: 'How many rows does `SELECT name, dept_id, SUM(salary) OVER (PARTITION BY dept_id) FROM employees` return if `employees` has 12 rows across 3 departments?',
              options: ['3 rows', '12 rows', '1 row', '36 rows'],
              correctIndex: 1,
              explanation:
                'Window functions compute an aggregate per partition without collapsing rows, so all 12 employee rows are preserved.',
            },
            {
              id: 'sql-q4',
              prompt: 'If two departments tie for 1st place in payroll, what rank does `RANK() OVER (ORDER BY total_salary DESC)` assign to the next-highest department?',
              options: ['1', '2', '3', 'NULL'],
              correctIndex: 2,
              explanation:
                '`RANK()` leaves a gap after ties (`1, 1, 3`), whereas `DENSE_RANK()` assigns `1, 1, 2`.',
            },
          ],
        },
        {
          id: 'sql-m1-lab',
          type: 'lab',
          title: 'Lab: Department Payroll & Rank Analysis',
          estimatedMins: 20,
          language: 'sql',
          objective:
            'Combine `INNER JOIN`, `GROUP BY`, and `RANK() OVER (ORDER BY SUM(e.salary) DESC)` in SQLite 3 to summarize and rank department payroll.',
          steps: [
            'Keep the `DROP TABLE`, `CREATE TABLE`, and `INSERT` statements at the top of `query.sql` intact.',
            'Join `departments d` with `employees e` on `e.dept_id = d.id` using `INNER JOIN`.',
            'Group by `d.id, d.name` and select `d.name`, `COUNT(e.id) AS headcount`, `SUM(e.salary) AS total_payroll`, and `RANK() OVER (ORDER BY SUM(e.salary) DESC) AS payroll_rank`.',
            'Order the final output by `payroll_rank ASC, d.name ASC`.',
            'Run tests in Cortex IDE and verify the pipe-delimited output matches `Engineering|2|260000|1` followed by `Product` and `Design`.',
          ],
          starterCode: `DROP TABLE IF EXISTS employees;
DROP TABLE IF EXISTS departments;

CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  salary INTEGER NOT NULL
);

INSERT INTO departments (id, name) VALUES
  (1, 'Engineering'),
  (2, 'Product'),
  (3, 'Design');

INSERT INTO employees (id, name, dept_id, salary) VALUES
  (1, 'Elena', 1, 120000),
  (2, 'Marcus', 1, 140000),
  (3, 'Priya', 2, 110000),
  (4, 'Liam', 2, 130000),
  (5, 'Sora', 3, 95000);

-- TODO: Write a single SELECT query below (keep table setup above intact)
-- Return columns: department_name, headcount, total_payroll, payroll_rank
-- Combine INNER JOIN, GROUP BY, and RANK() OVER (ORDER BY SUM(e.salary) DESC)
-- Order results by payroll_rank ASC, d.name ASC
`,
          testCases: [
            {
              id: 'sql-m1-lab-tc1',
              input: '',
              expectedStdout: 'Engineering|2|260000|1\nProduct|2|240000|2\nDesign|1|95000|3',
              isHidden: false,
            },
          ],
        },
      ],
    },
  ],
};
