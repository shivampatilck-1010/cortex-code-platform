import type { Challenge } from './challenges-data';

export const SQL_CHALLENGES: Challenge[] = [
  {
    id: 'sql-high-gpa-students',
    title: 'High-GPA Honor Roll Query',
    slug: 'sql-high-gpa-students',
    difficulty: 'Easy',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Beginner',
    category: 'SQL Basics & Filtering',
    tags: ['SQL Basics', 'Filtering'],
    companyTags: ['DataGrid', 'CloudCore'],
    description:
      'Given the `student_records` table initialized below, write a SQL query that returns `name`, `major`, and `gpa` for all students with `gpa >= 3.7`, ordered by `gpa` descending.',
    constraints: [
      'Return columns in exact order: name, major, gpa.',
      'Sort results by gpa DESC.',
    ],
    examples: [
      {
        input: 'student_records(id, name, major, gpa)',
        output: 'Jordan Lee | Data Science | 3.92\nAlex Morgan | Computer Science | 3.85\nDevon Patel | Computer Science | 3.72',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS student_records;
CREATE TABLE student_records (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  major TEXT NOT NULL,
  gpa REAL NOT NULL
);

INSERT INTO student_records (id, name, major, gpa) VALUES
  (1, 'Alex Morgan', 'Computer Science', 3.85),
  (2, 'Jordan Lee', 'Data Science', 3.92),
  (3, 'Taylor Brooks', 'Software Engineering', 3.45),
  (4, 'Devon Patel', 'Computer Science', 3.72),
  (5, 'Casey Zhang', 'Information Systems', 3.20);

-- TODO: Write your SQL query below (keep table setup above intact)
-- Return columns: name, major, gpa for students with gpa >= 3.7 ordered by gpa DESC

`,
    },
    testCases: [
      {
        id: 'sql-gpa-1',
        name: 'Honor Roll Filter & Sort',
        stdin: '',
        expectedStdout: 'Jordan Lee|Data Science|3.92\nAlex Morgan|Computer Science|3.85\nDevon Patel|Computer Science|3.72',
        isHidden: false,
      },
    ],
    hints: ['Use `WHERE gpa >= 3.7` combined with `ORDER BY gpa DESC`.'],
    acceptanceRate: '81.5%',
  },
  {
    id: 'sql-department-salary-summary',
    title: 'Department Payroll Aggregation',
    slug: 'sql-department-salary-summary',
    difficulty: 'Easy',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Beginner',
    category: 'Aggregation & Grouping',
    tags: ['Aggregation', 'Group By'],
    companyTags: ['FinScale', 'DataGrid'],
    description:
      'Using the `staff_payroll` table below, write a SQL query to return each `department`, its employee `headcount` (`COUNT(*)`), and its `total_payroll` (`SUM(salary)`), ordered by `total_payroll` descending.',
    constraints: [
      'Return columns: department, headcount, total_payroll.',
      'Order by total_payroll DESC.',
    ],
    examples: [
      {
        input: 'staff_payroll(id, name, department, salary)',
        output: 'Engineering | 2 | 260000\nProduct | 2 | 240000\nDesign | 1 | 95000',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS staff_payroll;
CREATE TABLE staff_payroll (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  department TEXT NOT NULL,
  salary INTEGER NOT NULL
);

INSERT INTO staff_payroll (id, name, department, salary) VALUES
  (1, 'Elena', 'Engineering', 120000),
  (2, 'Marcus', 'Engineering', 140000),
  (3, 'Priya', 'Product', 110000),
  (4, 'Liam', 'Product', 130000),
  (5, 'Sora', 'Design', 95000);

-- TODO: Write your SQL query below (keep table setup above intact)
-- Return columns: department, headcount, total_payroll ordered by total_payroll DESC

`,
    },
    testCases: [
      {
        id: 'sql-dept-1',
        name: 'Department Payroll Totals',
        stdin: '',
        expectedStdout: 'Engineering|2|260000\nProduct|2|240000\nDesign|1|95000',
        isHidden: false,
      },
    ],
    hints: ['Group rows by `department` and compute `COUNT(*)` and `SUM(salary)`.'],
    acceptanceRate: '76.0%',
  },
  {
    id: 'sql-employee-department-join',
    title: 'Employee & Department Directory Join',
    slug: 'sql-employee-department-join',
    difficulty: 'Easy',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Beginner',
    category: 'Relational Joins',
    tags: ['Joins', 'Filtering'],
    companyTags: ['ApexSystems', 'CloudCore'],
    description:
      'Join `org_employees` with `org_departments` on `dept_id = org_departments.id` and return `emp_name`, `dept_name`, and `role` for employees in either `Platform` or `Security`, sorted alphabetically by `emp_name`.',
    constraints: [
      'Return columns: emp_name, dept_name, role.',
      'Filter to Platform and Security departments, ordered by emp_name ASC.',
    ],
    examples: [
      {
        input: 'org_departments + org_employees',
        output: 'Hana | Platform | Systems Engineer\nNadia | Platform | Staff Engineer\nOmar | Security | Security Lead',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS org_employees;
DROP TABLE IF EXISTS org_departments;

CREATE TABLE org_departments (
  id INTEGER PRIMARY KEY,
  dept_name TEXT NOT NULL
);

CREATE TABLE org_employees (
  id INTEGER PRIMARY KEY,
  emp_name TEXT NOT NULL,
  dept_id INTEGER NOT NULL,
  role TEXT NOT NULL
);

INSERT INTO org_departments (id, dept_name) VALUES
  (1, 'Platform'),
  (2, 'Security'),
  (3, 'Analytics');

INSERT INTO org_employees (id, emp_name, dept_id, role) VALUES
  (10, 'Nadia', 1, 'Staff Engineer'),
  (11, 'Omar', 2, 'Security Lead'),
  (12, 'Hana', 1, 'Systems Engineer'),
  (13, 'Victor', 3, 'Data Analyst');

-- TODO: Write your SQL query below (keep table setup above intact)
-- Return columns: emp_name, dept_name, role for Platform and Security, ordered by emp_name ASC

`,
    },
    testCases: [
      {
        id: 'sql-join-1',
        name: 'Filtered Directory Join',
        stdin: '',
        expectedStdout: 'Hana|Platform|Systems Engineer\nNadia|Platform|Staff Engineer\nOmar|Security|Security Lead',
        isHidden: false,
      },
    ],
    hints: ['Use `INNER JOIN org_departments d ON e.dept_id = d.id` and filter with `IN (...)`.'],
    acceptanceRate: '73.2%',
  },
  {
    id: 'sql-active-courses-enrollment',
    title: 'Popular Courses Enrollment Threshold',
    slug: 'sql-active-courses-enrollment',
    difficulty: 'Medium',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Intermediate',
    category: 'Joins & Having',
    tags: ['Joins', 'Group By', 'Aggregation'],
    companyTags: ['DataGrid', 'NexaTech'],
    description:
      'Join `course_catalog` and `course_enrollments` to find courses with at least `2` enrolled students. Return `code` and `enrolled_count`, ordered by `enrolled_count` descending then `code` ascending.',
    constraints: [
      'Use GROUP BY with HAVING COUNT(*) >= 2.',
      'Order by enrolled_count DESC, code ASC.',
    ],
    examples: [
      {
        input: 'course_catalog + course_enrollments',
        output: 'CS101 | 3\nDB201 | 2',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS course_enrollments;
DROP TABLE IF EXISTS course_catalog;

CREATE TABLE course_catalog (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL,
  title TEXT NOT NULL
);

CREATE TABLE course_enrollments (
  id INTEGER PRIMARY KEY,
  course_id INTEGER NOT NULL,
  student_name TEXT NOT NULL
);

INSERT INTO course_catalog (id, code, title) VALUES
  (101, 'CS101', 'Algorithms'),
  (102, 'DB201', 'Databases'),
  (103, 'OS301', 'Operating Systems');

INSERT INTO course_enrollments (id, course_id, student_name) VALUES
  (1, 101, 'Student A'),
  (2, 101, 'Student B'),
  (3, 101, 'Student C'),
  (4, 102, 'Student A'),
  (5, 102, 'Student D'),
  (6, 103, 'Student E');

-- TODO: Write your SQL query below (keep table setup above intact)
-- Return columns: code, enrolled_count for courses with >= 2 enrollments

`,
    },
    testCases: [
      {
        id: 'sql-enr-1',
        name: 'Courses With >= 2 Students',
        stdin: '',
        expectedStdout: 'CS101|3\nDB201|2',
        isHidden: false,
      },
    ],
    hints: ['Filter grouped aggregates using `HAVING COUNT(e.id) >= 2` rather than `WHERE`.'],
    acceptanceRate: '64.5%',
  },
  {
    id: 'sql-above-average-earners',
    title: 'Employees Earning Above Company Average',
    slug: 'sql-above-average-earners',
    difficulty: 'Medium',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Intermediate',
    category: 'Subqueries',
    tags: ['Subqueries', 'Filtering', 'Aggregation'],
    companyTags: ['FinScale', 'QuantLabs'],
    description:
      'Using a scalar subquery, return `emp_name` and `salary` from `company_salaries` for all employees whose salary is strictly greater than the average salary across the company, ordered by `salary` descending.',
    constraints: [
      'Return columns: emp_name, salary.',
      'Sort by salary DESC.',
    ],
    examples: [
      {
        input: 'company_salaries(id, emp_name, salary)',
        output: 'Maya | 150000\nNoah | 120000',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS company_salaries;
CREATE TABLE company_salaries (
  id INTEGER PRIMARY KEY,
  emp_name TEXT NOT NULL,
  salary INTEGER NOT NULL
);

INSERT INTO company_salaries (id, emp_name, salary) VALUES
  (1, 'Ava', 80000),
  (2, 'Noah', 120000),
  (3, 'Maya', 150000),
  (4, 'Leo', 90000);

-- TODO: Write your SQL query below (keep table setup above intact)
-- Return columns: emp_name, salary where salary > company average, ordered by salary DESC

`,
    },
    testCases: [
      {
        id: 'sql-sub-1',
        name: 'Above Average Salaries',
        stdin: '',
        expectedStdout: 'Maya|150000\nNoah|120000',
        isHidden: false,
      },
    ],
    hints: ['Compare `salary > (SELECT AVG(salary) FROM company_salaries)`.'],
    acceptanceRate: '68.8%',
  },
  {
    id: 'sql-running-revenue-total',
    title: 'Monthly Running Revenue Total',
    slug: 'sql-running-revenue-total',
    difficulty: 'Medium',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Intermediate',
    category: 'Window Functions',
    tags: ['Window Functions', 'Aggregation'],
    companyTags: ['FinScale', 'DataGrid', 'CloudCore'],
    description:
      'Using a SQL window function on `monthly_sales`, return `month_num`, `revenue`, and the cumulative `running_total` ordered by `month_num` ascending.',
    constraints: [
      'Return columns: month_num, revenue, running_total.',
      'Order by month_num ASC.',
    ],
    examples: [
      {
        input: 'monthly_sales(month_num, region, revenue)',
        output: '1 | 1200 | 1200\n2 | 1800 | 3000\n3 | 1500 | 4500',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS monthly_sales;
CREATE TABLE monthly_sales (
  month_num INTEGER PRIMARY KEY,
  region TEXT NOT NULL,
  revenue INTEGER NOT NULL
);

INSERT INTO monthly_sales (month_num, region, revenue) VALUES
  (1, 'North', 1200),
  (2, 'North', 1800),
  (3, 'North', 1500);

-- TODO: Write your SQL query below (keep table setup above intact)
-- Return columns: month_num, revenue, running_total ordered by month_num ASC

`,
    },
    testCases: [
      {
        id: 'sql-win-1',
        name: 'Cumulative Window Sum',
        stdin: '',
        expectedStdout: '1|1200|1200\n2|1800|3000\n3|1500|4500',
        isHidden: false,
      },
    ],
    hints: ['Use `SUM(revenue) OVER (ORDER BY month_num)` to calculate cumulative totals.'],
    acceptanceRate: '59.4%',
  },
  {
    id: 'sql-top-salary-per-department',
    title: 'Highest Earner Per Team (Window Rank)',
    slug: 'sql-top-salary-per-department',
    difficulty: 'Hard',
    track: 'SQL',
    topicCategory: 'Database',
    level: 'Advanced',
    category: 'Window Functions & CTE',
    tags: ['Window Functions', 'Joins', 'Subqueries'],
    companyTags: ['QuantLabs', 'CloudCore', 'FinScale'],
    description:
      'Using a CTE and `ROW_NUMBER()` (or `DENSE_RANK()`) partitioned by `team_id`, find the highest-paid member in each team. Return `team_name`, `member_name`, and `salary`, ordered by `team_name` ascending.',
    constraints: [
      'Return columns: team_name, member_name, salary.',
      'Order by team_name ASC.',
    ],
    examples: [
      {
        input: 'eng_teams + eng_members',
        output: 'Cloud | Chloe | 155000\nCore | Ben | 145000',
      },
    ],
    starterTemplates: {
      sql: `DROP TABLE IF EXISTS eng_members;
DROP TABLE IF EXISTS eng_teams;

CREATE TABLE eng_teams (
  id INTEGER PRIMARY KEY,
  team_name TEXT NOT NULL
);

CREATE TABLE eng_members (
  id INTEGER PRIMARY KEY,
  member_name TEXT NOT NULL,
  team_id INTEGER NOT NULL,
  salary INTEGER NOT NULL
);

INSERT INTO eng_teams (id, team_name) VALUES
  (1, 'Core'),
  (2, 'Cloud');

INSERT INTO eng_members (id, member_name, team_id, salary) VALUES
  (1, 'Aria', 1, 135000),
  (2, 'Ben', 1, 145000),
  (3, 'Chloe', 2, 155000),
  (4, 'Dan', 2, 140000);

-- TODO: Write your SQL query below using a CTE + window function
-- Return columns: team_name, member_name, salary for the top earner per team, ordered by team_name ASC

`,
    },
    testCases: [
      {
        id: 'sql-rank-1',
        name: 'Top Earner Per Team',
        stdin: '',
        expectedStdout: 'Cloud|Chloe|155000\nCore|Ben|145000',
        isHidden: false,
      },
    ],
    hints: [
      'Wrap `ROW_NUMBER() OVER (PARTITION BY m.team_id ORDER BY m.salary DESC)` in a CTE and filter `WHERE rn = 1`.',
    ],
    acceptanceRate: '49.1%',
  },
];
