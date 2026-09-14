import time
import os

while True:
    with open(r'C:\Users\shiva\.gemini\antigravity\brain\b407aebb-cb93-40dd-9882-68622e79231c\.system_generated\tasks\task-4907.log', 'r') as f:
        content = f.read()
        if 'Route (app)' in content or 'exited with code' in content:
            print('Build finished!')
            break
    time.sleep(2)
