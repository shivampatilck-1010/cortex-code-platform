
  INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
  VALUES ('usr_mvlyg1pd44g4k', 'shivam', 'shivampatilcka@gmail.com', 'SHIVAM_PROF', 'teacher', 'active', 1791956210682, 1792820210682);


    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_alex', 'Alex Chen', 'alex.chen@student.cortex.edu', 'alexchen', 'student', 'active', 1792388210682, 1792820210682);
  

    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_sophia', 'Sophia Patel', 'sophia.patel@student.cortex.edu', 'sophiap', 'student', 'active', 1792474610682, 1792820210682);
  

    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_marcus', 'Marcus Vance', 'marcus.vance@student.cortex.edu', 'mvance', 'student', 'active', 1792561010682, 1792820210682);
  

    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_elena', 'Elena Rostova', 'elena.rostova@student.cortex.edu', 'erostova', 'student', 'active', 1792561010682, 1792820210682);
  

    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_demo_liam', 'Liam Wright', 'liam.wright@student.cortex.edu', 'lwright', 'student', 'active', 1792647410682, 1792820210682);
  

    INSERT OR REPLACE INTO users (id, name, email, cortex_id, role, status, created_at, updated_at)
    VALUES ('usr_mvly9ov4snurx', 'Aniket Agarwal', 'aniket.agr2007@gmail.com', 'ANIKET2026', 'student', 'active', 1792733810682, 1792820210682);
  

    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, join_code, join_enabled, status, created_at, updated_at, settings_json
    ) VALUES (
      'CLS_DEMO_DSA_2026',
      'CS 201: Data Structures and Algorithms',
      'Computer Science',
      'Comprehensive algorithmic laboratory covering linear structures, binary search trees, graph algorithms, and competitive programming with real-time automated evaluation.',
      'CS-201',
      '2026-2027',
      'Sec 01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'CORTEX26',
      1,
      'active',
      1792215410682,
      1792820210682,
      '{"allowStudentPosting":true,"allowStudentMessaging":true,"allowCodeSharing":true,"leaderboardEnabled":true,"defaultAIPolicy":"hints_only"}'
    );
  

    INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_DEMO_DSA_2026_usr_mvlyg1pd44g4k',
      'CLS_DEMO_DSA_2026',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'shivampatilcka@gmail.com',
      'teacher',
      'active',
      1792215410682,
      1792820210682,
      1
    );
  

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_DEMO_DSA_2026_usr_demo_alex',
        'CLS_DEMO_DSA_2026',
        'usr_demo_alex',
        'Alex Chen',
        'alex.chen@student.cortex.edu',
        'student',
        'active',
        1792388210682,
        1792820030682,
        1
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_DEMO_DSA_2026_usr_demo_sophia',
        'CLS_DEMO_DSA_2026',
        'usr_demo_sophia',
        'Sophia Patel',
        'sophia.patel@student.cortex.edu',
        'student',
        'active',
        1792474610682,
        1792819610682,
        1
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_DEMO_DSA_2026_usr_demo_marcus',
        'CLS_DEMO_DSA_2026',
        'usr_demo_marcus',
        'Marcus Vance',
        'marcus.vance@student.cortex.edu',
        'student',
        'active',
        1792561010682,
        1792813010682,
        0
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_DEMO_DSA_2026_usr_demo_elena',
        'CLS_DEMO_DSA_2026',
        'usr_demo_elena',
        'Elena Rostova',
        'elena.rostova@student.cortex.edu',
        'student',
        'active',
        1792561010682,
        1792819310682,
        1
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_DEMO_DSA_2026_usr_demo_liam',
        'CLS_DEMO_DSA_2026',
        'usr_demo_liam',
        'Liam Wright',
        'liam.wright@student.cortex.edu',
        'student',
        'active',
        1792647410682,
        1792805810682,
        0
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_DEMO_DSA_2026_usr_mvly9ov4snurx',
        'CLS_DEMO_DSA_2026',
        'usr_mvly9ov4snurx',
        'Aniket Agarwal',
        'aniket.agr2007@gmail.com',
        'student',
        'active',
        1792733810682,
        1792819910682,
        1
      );
    

    INSERT OR REPLACE INTO classrooms (
      id, name, subject, description, course_code, academic_year, section,
      teacher_id, teacher_name, join_code, join_enabled, status, created_at, updated_at, settings_json
    ) VALUES (
      'CLS_1792819623330_ZF01',
      'CS 276: Systems Programming & Concurrency (cse276)',
      'Computer Science',
      'Advanced systems programming in C++ and Python. Explores lock-free concurrency, asynchronous I/O, consistent hashing, and distributed consensus algorithms.',
      'CS-276',
      '2026-2027',
      'Sec 02',
      'usr_mvlyg1pd44g4k',
      'shivam',
      '39TX43',
      1,
      'active',
      1792733810682,
      1792820210682,
      '{"allowStudentPosting":true,"allowStudentMessaging":true,"allowCodeSharing":true,"leaderboardEnabled":true,"defaultAIPolicy":"hints_only"}'
    );
  

    INSERT OR REPLACE INTO classroom_members (
      id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
    ) VALUES (
      'mem_CLS_1792819623330_ZF01_usr_mvlyg1pd44g4k',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'shivampatilcka@gmail.com',
      'teacher',
      'active',
      1792733810682,
      1792820210682,
      1
    );
  

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_1792819623330_ZF01_usr_demo_alex',
        'CLS_1792819623330_ZF01',
        'usr_demo_alex',
        'Alex Chen',
        'alex.chen@student.cortex.edu',
        'student',
        'active',
        1792388210682,
        1792820030682,
        1
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_1792819623330_ZF01_usr_demo_sophia',
        'CLS_1792819623330_ZF01',
        'usr_demo_sophia',
        'Sophia Patel',
        'sophia.patel@student.cortex.edu',
        'student',
        'active',
        1792474610682,
        1792819610682,
        1
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_1792819623330_ZF01_usr_demo_marcus',
        'CLS_1792819623330_ZF01',
        'usr_demo_marcus',
        'Marcus Vance',
        'marcus.vance@student.cortex.edu',
        'student',
        'active',
        1792561010682,
        1792813010682,
        0
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_1792819623330_ZF01_usr_demo_elena',
        'CLS_1792819623330_ZF01',
        'usr_demo_elena',
        'Elena Rostova',
        'elena.rostova@student.cortex.edu',
        'student',
        'active',
        1792561010682,
        1792819310682,
        1
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_1792819623330_ZF01_usr_demo_liam',
        'CLS_1792819623330_ZF01',
        'usr_demo_liam',
        'Liam Wright',
        'liam.wright@student.cortex.edu',
        'student',
        'active',
        1792647410682,
        1792805810682,
        0
      );
    

      INSERT OR REPLACE INTO classroom_members (
        id, classroom_id, user_id, user_name, user_email, role, status, joined_at, last_active_at, is_online
      ) VALUES (
        'mem_CLS_1792819623330_ZF01_usr_mvly9ov4snurx',
        'CLS_1792819623330_ZF01',
        'usr_mvly9ov4snurx',
        'Aniket Agarwal',
        'aniket.agr2007@gmail.com',
        'student',
        'active',
        1792733810682,
        1792819910682,
        1
      );
    

    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_dsa_welcome',
      'CLS_DEMO_DSA_2026',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'teacher',
      'Welcome to CS 201: Algorithmic Systems & Data Structures',
      'Welcome everyone to the demo classroom. In this course, we examine algorithmic efficiency, time and space complexity, and advanced data structures using the Cortex collaborative execution environment.

Please inspect the assignments tab for open labs and review the reference guides in Resources.',
      1,
      1792561010682,
      1792561010682
    );
  

    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_dsa_lab1',
      'CLS_DEMO_DSA_2026',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'teacher',
      'Lab Assignment 1: Two Sum Hash Map Optimization Published',
      'The first coding assignment is open. Implement twoSum with O(n) linear time complexity.

Make sure your solution handles negative numbers, duplicate elements, and large inputs. Both public and hidden test cases are executed automatically.',
      0,
      1792647410682,
      1792647410682
    );
  

    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_dsa_bst',
      'CLS_DEMO_DSA_2026',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'teacher',
      'Lab Assignment 2: Binary Search Tree Validation in C++',
      'The C++ BST verification lab is published. Implement isValidBST verifying recursive lower and upper bounds.

Review starter code and test suite in the assignment solver.',
      0,
      1792733810682,
      1792733810682
    );
  

    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_cse_welcome',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'teacher',
      'Welcome to CS 276: Systems Programming & Concurrency',
      'Welcome to CS 276! In this course, we delve deep into operating system fundamentals, concurrent synchronization primitives, lock-free queues, and distributed consensus.

Check the assignments tab for our first concurrency lab.',
      1,
      1792733810682,
      1792733810682
    );
  

    INSERT OR REPLACE INTO announcements (
      id, classroom_id, author_id, author_name, author_role, title, content, pinned, created_at, updated_at
    ) VALUES (
      'ann_cse_lab1',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'teacher',
      'Lab 1: Bounded Concurrent Queue with Thread Safety Published',
      'Lab 1 is now open for submissions. Implement a thread-safe circular buffer queue with condition variable synchronization in Python.

Automated multi-thread stress tests will evaluate your implementation against race conditions.',
      0,
      1792777010682,
      1792777010682
    );
  

    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language,
      starter_code, difficulty, max_marks, due_at, published_at,
      attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy,
      status, created_by, created_at, updated_at, test_cases_json
    ) VALUES (
      'asg_cse_queue',
      'CLS_1792819623330_ZF01',
      'Lab 1: Thread-Safe Bounded Concurrent Queue',
      'Implement a thread-safe bounded FIFO queue using mutex locks and condition variables in Python. Your class ConcurrentQueue must support push(item, timeout), pop(timeout), and size() operations without deadlocks.',
      '1. Use threading.Lock and threading.Condition to guard push and pop operations.
2. When full, push must block up to timeout seconds.
3. When empty, pop must block up to timeout seconds.
4. Avoid busy-waiting.',
      'coding',
      'python',
      'import threading
import time

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_full = threading.Condition(self.lock)
        self.not_empty = threading.Condition(self.lock)

    def push(self, item, timeout: float = 1.0) -> bool:
        # TODO: Implement thread-safe bounded push
        with self.not_full:
            self.queue.append(item)
            self.not_empty.notify()
            return True

    def pop(self, timeout: float = 1.0):
        # TODO: Implement thread-safe bounded pop
        with self.not_empty:
            if not self.queue:
                return None
            return self.queue.pop(0)

    def size(self) -> int:
        with self.lock:
            return len(self.queue)

# Test harness
if __name__ == "__main__":
    q = ConcurrentQueue(3)
    q.push("task_1")
    q.push("task_2")
    print(f"Size: {q.size()}")
    print(f"Popped: {q.pop()}")
    print(f"Size: {q.size()}")
',
      'medium',
      100,
      1793252210682,
      1792733810682,
      3,
      1,
      10,
      1,
      1,
      'hints_only',
      'review_only',
      'published',
      'usr_mvlyg1pd44g4k',
      1792733810682,
      1792820210682,
      '[{"input":"push(A), push(B), pop(), size()","expectedOutput":"Size: 2\nPopped: task_1\nSize: 1","isHidden":false,"points":50},{"input":"concurrent_producers_consumers(100_items)","expectedOutput":"All 100 items processed cleanly","isHidden":true,"points":50}]'
    );
  

    INSERT OR REPLACE INTO assignments (
      id, classroom_id, title, description, instructions, type, language,
      starter_code, difficulty, max_marks, due_at, published_at,
      attempts_allowed, allow_late_submission, late_penalty_percent,
      auto_grade, manual_grade, ai_policy, plagiarism_policy,
      status, created_by, created_at, updated_at, test_cases_json
    ) VALUES (
      'asg_cse_hashring',
      'CLS_1792819623330_ZF01',
      'Lab 2: Consistent Hashing Ring with Virtual Nodes',
      'Implement a distributed Consistent Hash Ring supporting add_node, remove_node, and get_node for key lookups. Distribute keys uniformly across replica virtual nodes using MD5/SHA-256.',
      '1. Implement MD5 hashing mapped onto a 32-bit integer ring.
2. Use bisect for O(log N) key lookups.
3. Support virtual node replicas per physical node.
4. Verify uniform partition balance.',
      'coding',
      'python',
      'import hashlib
import bisect

class ConsistentHashRing:
    def __init__(self, replicas: int = 3):
        self.replicas = replicas
        self.ring = []
        self.node_map = {}

    def _hash(self, key: str) -> int:
        return int(hashlib.md5(key.encode(''utf-8'')).hexdigest(), 16)

    def add_node(self, node: str) -> None:
        for i in range(self.replicas):
            vkey = f"{node}#replica_{i}"
            h = self._hash(vkey)
            bisect.insort(self.ring, h)
            self.node_map[h] = node

    def get_node(self, key: str) -> str:
        if not self.ring:
            return None
        h = self._hash(key)
        idx = bisect.bisect_right(self.ring, h)
        if idx == len(self.ring):
            idx = 0
        return self.node_map[self.ring[idx]]

if __name__ == "__main__":
    ring = ConsistentHashRing(replicas=3)
    ring.add_node("server_alpha")
    ring.add_node("server_beta")
    print("Key user_1001 mapped to:", ring.get_node("user_1001"))
',
      'hard',
      100,
      1793857010682,
      1792733810682,
      3,
      1,
      10,
      1,
      1,
      'hints_only',
      'review_only',
      'published',
      'usr_mvlyg1pd44g4k',
      1792733810682,
      1792820210682,
      '[{"input":"add_node(alpha), add_node(beta), get_node(user_1001)","expectedOutput":"Key user_1001 mapped to: server_alpha","isHidden":false,"points":50},{"input":"rebalance_test(remove_node)","expectedOutput":"Minimal key redistribution verified","isHidden":true,"points":50}]'
    );
  

    INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name,
      code, language, version, status, submitted_at, execution_started_at, execution_completed_at,
      score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_cse_alex_1',
      'asg_cse_queue',
      'Lab 1: Thread-Safe Bounded Concurrent Queue',
      'CLS_1792819623330_ZF01',
      'usr_demo_alex',
      'Alex Chen',
      '# Alex Chen submission for Concurrent Queue
import threading
import time

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_full = threading.Condition(self.lock)
        self.not_empty = threading.Condition(self.lock)

    def push(self, item, timeout: float = 1.0) -> bool:
        with self.not_full:
            while len(self.queue) >= self.capacity:
                if not self.not_full.wait(timeout=timeout):
                    return False
            self.queue.append(item)
            self.not_empty.notify()
            return True

    def pop(self, timeout: float = 1.0):
        with self.not_empty:
            while not self.queue:
                if not self.not_empty.wait(timeout=timeout):
                    return None
            item = self.queue.pop(0)
            self.not_full.notify()
            return item

    def size(self) -> int:
        with self.lock:
            return len(self.queue)
',
      'python',
      1,
      'completed',
      1792798610682,
      1792798610682,
      1792798610724,
      100,
      100,
      0,
      '[{"id":1,"name":"Basic Push and Pop","status":"passed","executionTimeMs":12},{"id":2,"name":"Concurrent Thread Stress Test","status":"passed","executionTimeMs":30}]'
    );
  

    INSERT OR REPLACE INTO grades (
      id, submission_id, student_id, assignment_id,
      automatic_score, manual_adjustment, final_score,
      graded_by, graded_by_name, graded_at
    ) VALUES (
      'grd_sub_cse_alex_1',
      'sub_cse_alex_1',
      'usr_demo_alex',
      'asg_cse_queue',
      100,
      0,
      100,
      'usr_mvlyg1pd44g4k',
      'shivam',
      1792813010682
    );
  

    INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name,
      code, language, version, status, submitted_at, execution_started_at, execution_completed_at,
      score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_cse_sophia_1',
      'asg_cse_queue',
      'Lab 1: Thread-Safe Bounded Concurrent Queue',
      'CLS_1792819623330_ZF01',
      'usr_demo_sophia',
      'Sophia Patel',
      '# Sophia Patel submission
import threading

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.cv = threading.Condition()

    def push(self, item, timeout: float = 1.0) -> bool:
        with self.cv:
            while len(self.queue) >= self.capacity:
                self.cv.wait(timeout=timeout)
            self.queue.append(item)
            self.cv.notify_all()
            return True

    def pop(self, timeout: float = 1.0):
        with self.cv:
            while not self.queue:
                self.cv.wait(timeout=timeout)
            item = self.queue.pop(0)
            self.cv.notify_all()
            return item

    def size(self) -> int:
        with self.cv:
            return len(self.queue)
',
      'python',
      1,
      'completed',
      1792798610682,
      1792798610682,
      1792798610724,
      95,
      100,
      0,
      '[{"id":1,"name":"Basic Push and Pop","status":"passed","executionTimeMs":12},{"id":2,"name":"Concurrent Thread Stress Test","status":"passed","executionTimeMs":30}]'
    );
  

    INSERT OR REPLACE INTO grades (
      id, submission_id, student_id, assignment_id,
      automatic_score, manual_adjustment, final_score,
      graded_by, graded_by_name, graded_at
    ) VALUES (
      'grd_sub_cse_sophia_1',
      'sub_cse_sophia_1',
      'usr_demo_sophia',
      'asg_cse_queue',
      95,
      0,
      95,
      'usr_mvlyg1pd44g4k',
      'shivam',
      1792813010682
    );
  

    INSERT OR REPLACE INTO submissions (
      id, assignment_id, assignment_title, classroom_id, student_id, student_name,
      code, language, version, status, submitted_at, execution_started_at, execution_completed_at,
      score, max_score, is_late, test_results_json
    ) VALUES (
      'sub_cse_aniket_1',
      'asg_cse_queue',
      'Lab 1: Thread-Safe Bounded Concurrent Queue',
      'CLS_1792819623330_ZF01',
      'usr_mvly9ov4snurx',
      'Aniket Agarwal',
      '# Aniket Agarwal submission
import threading

class ConcurrentQueue:
    def __init__(self, capacity: int = 10):
        self.capacity = capacity
        self.queue = []
        self.lock = threading.Lock()
        self.not_empty = threading.Condition(self.lock)
        self.not_full = threading.Condition(self.lock)

    def push(self, item, timeout: float = 1.0) -> bool:
        with self.not_full:
            if len(self.queue) < self.capacity:
                self.queue.append(item)
                self.not_empty.notify()
                return True
            return False

    def pop(self, timeout: float = 1.0):
        with self.not_empty:
            if self.queue:
                item = self.queue.pop(0)
                self.not_full.notify()
                return item
            return None

    def size(self) -> int:
        with self.lock:
            return len(self.queue)
',
      'python',
      1,
      'completed',
      1792798610682,
      1792798610682,
      1792798610724,
      90,
      100,
      0,
      '[{"id":1,"name":"Basic Push and Pop","status":"passed","executionTimeMs":12},{"id":2,"name":"Concurrent Thread Stress Test","status":"passed","executionTimeMs":30}]'
    );
  

    INSERT OR REPLACE INTO grades (
      id, submission_id, student_id, assignment_id,
      automatic_score, manual_adjustment, final_score,
      graded_by, graded_by_name, graded_at
    ) VALUES (
      'grd_sub_cse_aniket_1',
      'sub_cse_aniket_1',
      'usr_mvly9ov4snurx',
      'asg_cse_queue',
      90,
      0,
      90,
      'usr_mvlyg1pd44g4k',
      'shivam',
      1792813010682
    );
  

    INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_cse_syllabus',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'CS 276 Course Syllabus & Lecture Schedule',
      'link',
      'https://cortexcode.io/docs/cs276-syllabus.pdf',
      'Detailed syllabus, grading breakdown, lab schedule, and recommended concurrency textbooks.',
      'General',
      1792733810682,
      1,
      'public'
    );
  

    INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_cse_posix',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'POSIX Threads & Memory Model Quick Reference',
      'document',
      'https://cortexcode.io/docs/pthreads-reference.pdf',
      'Concise reference card detailing mutex locking, memory ordering, atomic operations, and condition variable semantics.',
      'Concurrency',
      1792733810682,
      1,
      'public'
    );
  

    INSERT OR REPLACE INTO resources (
      id, classroom_id, uploaded_by, uploaded_by_name, name, type, url, description, unit, created_at, pinned, visibility
    ) VALUES (
      'res_cse_raft',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'In Search of an Understandable Consensus Algorithm (Raft)',
      'link',
      'https://raft.github.io/raft.pdf',
      'Original research paper by Diego Ongaro and John Ousterhout with annotated implementation diagrams.',
      'Distributed Systems',
      1792733810682,
      1,
      'public'
    );
  

    INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, content, created_at, updated_at
    ) VALUES (
      'msg_cse_1',
      'CLS_1792819623330_ZF01',
      'usr_demo_alex',
      'Alex Chen',
      'student',
      'broadcast',
      'Professor, in Lab 1 for the circular buffer, should we throw an exception or return None when pop times out?',
      1792791410682,
      1792791410682
    );
  

    INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, content, created_at, updated_at
    ) VALUES (
      'msg_cse_2',
      'CLS_1792819623330_ZF01',
      'usr_mvlyg1pd44g4k',
      'shivam',
      'teacher',
      'broadcast',
      'Returning None on timeout is standard for Python queues. Ensure the condition variable timeout does not throw an uncaught exception.',
      1792795010682,
      1792795010682
    );
  

    INSERT OR REPLACE INTO messages (
      id, classroom_id, sender_id, sender_name, sender_role, recipient_type, content, created_at, updated_at
    ) VALUES (
      'msg_cse_3',
      'CLS_1792819623330_ZF01',
      'usr_demo_sophia',
      'Sophia Patel',
      'student',
      'broadcast',
      'Thank you! The test suite passed all concurrency stress tests smoothly.',
      1792802210682,
      1792802210682
    );
  

  INSERT OR REPLACE INTO live_sessions (
    id, classroom_id, teacher_id, teacher_name, title, topic, language, starter_code, shared_code, is_broadcasting_code, started_at, status
  ) VALUES (
    'session_live_dsa_2026',
    'CLS_DEMO_DSA_2026',
    'usr_mvlyg1pd44g4k',
    'shivam',
    'Live Algorithm Review: Hash Maps and BSTs',
    'Tree Traversals and Hash Maps',
    'python',
    '# Live Class Starter Code\ndef solve():\n    pass\n',
    '# Live Class Shared Code\ndef solve():\n    pass\n',
    1,
    1792818710682,
    'active'
  );
