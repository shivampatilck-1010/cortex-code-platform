with open("src/app/classroom/page.tsx", "r", encoding="utf-8") as f:
    content = f.read()

target = """  const filteredMembers = useMemo(() => {
    if (!searchMemberQuery.trim()) return members;
    const q = searchMemberQuery.toLowerCase();
    return members.filter(
      (m) => m.userName.toLowerCase().includes(q) || m.userEmail.toLowerCase().includes(q) || m.role.toLowerCase().includes(q)
    );
  }, [members, searchMemberQuery]);"""

replacement = """  const filteredMembers = useMemo(() => {
    const uniqueMap = new Map();
    members.forEach((m) => {
      const key = m.userEmail || m.userId;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, m);
      }
    });
    const uniqueMembers = Array.from(uniqueMap.values());
    
    if (!searchMemberQuery.trim()) return uniqueMembers;
    const q = searchMemberQuery.toLowerCase();
    return uniqueMembers.filter(
      (m) => m.userName.toLowerCase().includes(q) || (m.userEmail && m.userEmail.toLowerCase().includes(q)) || m.role.toLowerCase().includes(q)
    );
  }, [members, searchMemberQuery]);"""

content = content.replace(target, replacement)

with open("src/app/classroom/page.tsx", "w", encoding="utf-8") as f:
    f.write(content)
