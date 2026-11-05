const fs = require('fs');
const path = require('path');

const filePath = path.resolve('src/components/live-class/modules/assignments/AssignmentsModule.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Destructure session from useClassroom
const targetHook = `  const { setActiveModule, showToast, userRole } = useClassroom();`;
const newHook = `  const { setActiveModule, showToast, userRole, session } = useClassroom();
  const classroomId = session?.id || '';
  const [isLoadingServerAssignments, setIsLoadingServerAssignments] = useState(false);`;

if (content.includes(targetHook)) {
  content = content.replace(targetHook, newHook);
} else {
  content = content.replace(targetHook.replace(/\n/g, '\r\n'), newHook.replace(/\n/g, '\r\n'));
}

// 2. Add server assignments loading effect
const targetAfterState = `  // Selected assignment
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(() => {
    return assignments[0]?.id || 'lab-04';
  });`;

const newServerEffect = `  // Selected assignment
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<string>(() => {
    return assignments[0]?.id || 'lab-04';
  });

  // Load authoritative assignments from Cortex classroom API
  useEffect(() => {
    if (!classroomId || typeof window === 'undefined') return;
    let isMounted = true;
    setIsLoadingServerAssignments(true);

    fetch(\`/api/v1/classrooms/\${classroomId}/assignments\`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data?.assignments || !Array.isArray(data.assignments) || data.assignments.length === 0) return;

        const serverMapped: Assignment[] = data.assignments.map((a: any) => ({
          id: a.id,
          title: a.title,
          description: a.description || a.instructions || '',
          points: typeof a.maxMarks === 'number' ? a.maxMarks : 100,
          status: a.status || 'published',
          starterCode: a.starterCode || a.startercode || '',
          starterLanguage: a.language || 'C++17',
          difficulty: a.difficulty || 'medium',
          category: 'Core Curriculum',
          dueDate: new Date(a.dueAt || Date.now() + 86400000).toLocaleDateString(),
          testCases: Array.isArray(a.testCases) ? a.testCases.map((tc: any, idx: number) => ({
            id: tc.id || \`tc_\${idx + 1}\`,
            name: tc.name || \`Test Case \${idx + 1}\`,
            input: tc.input || '',
            expectedOutput: tc.expectedOutput || '',
            isHidden: Boolean(tc.visibility === 'hidden' || tc.isHidden),
            weight: typeof tc.weight === 'number' ? tc.weight : 25,
          })) : [],
          rubricCriteria: [],
        }));

        setAssignments(serverMapped);
        if (serverMapped[0]) {
          setSelectedAssignmentId(serverMapped[0].id);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setIsLoadingServerAssignments(false);
      });

    return () => { isMounted = false; };
  }, [classroomId]);`;

if (content.includes(targetAfterState)) {
  content = content.replace(targetAfterState, newServerEffect);
} else {
  content = content.replace(targetAfterState.replace(/\n/g, '\r\n'), newServerEffect.replace(/\n/g, '\r\n'));
}

// 3. Connect handleSubmit to API
const oldSubmitFetch = `      // Preserve full attempt history without overwriting previous attempts
      setSubmissions((prev) => [newSub, ...prev]);

      showToast(\`Assignment submitted successfully (Attempt #\${attemptNumber})\`);`;

const newSubmitFetch = `      // Preserve full attempt history locally
      setSubmissions((prev) => [newSub, ...prev]);

      // Synchronize with server if in live classroom context
      if (classroomId) {
        fetch(\`/api/v1/classrooms/\${classroomId}/assignments/\${selectedAssignment.id}/submit\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: currentCode,
            language: selectedAssignment.starterLanguage,
          }),
        }).catch(() => {});
      }

      showToast(\`Assignment submitted successfully (Attempt #\${attemptNumber})\`);`;

if (content.includes(oldSubmitFetch)) {
  content = content.replace(oldSubmitFetch, newSubmitFetch);
} else {
  content = content.replace(oldSubmitFetch.replace(/\n/g, '\r\n'), newSubmitFetch.replace(/\n/g, '\r\n'));
}

// 4. Connect handleSaveAssignment to API
const oldTeacherSave = `      setAssignments((prev) => [saved, ...prev]);
      setSelectedAssignmentId(saved.id);
      showToast(\`Created new assignment: \${saved.title}\`);`;

const newTeacherSave = `      setAssignments((prev) => [saved, ...prev]);
      setSelectedAssignmentId(saved.id);

      // Create on platform backend
      if (classroomId && userRole === 'teacher') {
        fetch(\`/api/v1/classrooms/\${classroomId}/assignments\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: saved.title,
            description: saved.description,
            instructions: saved.description,
            type: 'code',
            difficulty: saved.difficulty || 'medium',
            language: saved.starterLanguage || 'cpp',
            starterCode: saved.starterCode,
            dueAt: Date.now() + 7 * 86400000,
            maxMarks: saved.points || 100,
            testCases: saved.testCases,
          }),
        }).catch(() => {});
      }

      showToast(\`Created new assignment: \${saved.title}\`);`;

if (content.includes(oldTeacherSave)) {
  content = content.replace(oldTeacherSave, newTeacherSave);
} else {
  content = content.replace(oldTeacherSave.replace(/\n/g, '\r\n'), newTeacherSave.replace(/\n/g, '\r\n'));
}

fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully connected AssignmentsModule to platform assignment APIs');
