import re

with open('src/lib/classroom/db/index.ts', 'r') as f:
    lines = f.readlines()

new_lines = []
in_class = False

for line in lines:
    if 'class ClassroomDatabase {' in line:
        in_class = True
        new_lines.append(line)
        continue
        
    if in_class:
        # Match a method definition like `  createUser(user: User): User {`
        # or `  private seedDefaultClassroom() {`
        # but skip `constructor` and `getDb` and `init` which we already manually fixed
        match = re.match(r'^  (public |private )?([a-zA-Z0-9_]+)\((.*)\)(:\s*.*)?\s*\{\s*$', line)
        if match:
            access, name, args, ret = match.groups()
            if name not in ['constructor', 'getDb', 'init'] and 'async' not in line:
                access = access if access else ''
                ret = ret if ret else ''
                line = f"  {access}async {name}({args}){ret} {{\n"
                
    new_lines.append(line)

with open('src/lib/classroom/db/index.ts', 'w') as f:
    f.writelines(new_lines)
