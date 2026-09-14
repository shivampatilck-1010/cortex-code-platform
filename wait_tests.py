import time
import os
import sys

while True:
    with open(r'C:\Users\shiva\.gemini\antigravity\brain\b407aebb-cb93-40dd-9882-68622e79231c\.system_generated\tasks\task-4983.log', 'r') as f:
        content = f.read()
        if 'RESULTS: 30 / 30 PASS' in content:
            print('Phase 2E passed successfully!')
            sys.exit(0)
        elif 'FAIL' in content and 'node:sqlite' in content:
            print('SQLite failed again!')
            sys.exit(1)
        elif 'All constraints verified' in content:
            print('All constraints passed!')
            sys.exit(0)
    time.sleep(2)
