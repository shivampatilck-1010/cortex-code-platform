const fs = require('fs');
const path = require('path');

const targetFile = path.resolve(__dirname, '..', 'src', 'app', 'classroom', 'page.tsx');
let content = fs.readFileSync(targetFile, 'utf8');

// 1. Add import
if (!content.includes('ExaminationsTab')) {
  const importMarker = "import { TeamsTab } from '@/components/classroom/teams/TeamsTab';";
  content = content.replace(
    importMarker,
    `import { TeamsTab } from '@/components/classroom/teams/TeamsTab';\nimport { ExaminationsTab } from '@/components/classroom/exams/ExaminationsTab';`
  );
  console.log('Added ExaminationsTab import.');
}

// 2. Add 'examinations' to activeTab state type
if (!content.includes("'examinations' | 'teams'")) {
  content = content.replace(
    "activeTab, setActiveTab] = useState<'stream' | 'people' | 'assignments' | 'teams'",
    "activeTab, setActiveTab] = useState<'stream' | 'people' | 'assignments' | 'examinations' | 'teams'"
  );
  console.log('Updated activeTab state union.');
}

// 3. Add Examinations tab button in the tab bar
if (!content.includes("aria-selected={activeTab === 'examinations'}")) {
  const assignmentsTabButtonMarker = `                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'teams'}`;

  const examinationsTabButton = `                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'examinations'}
                    onClick={(e) => {
                      setActiveTab('examinations');
                      e.currentTarget.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                    }}
                    className={\`h-8 px-3 rounded-lg text-xs font-heading font-semibold transition flex items-center space-x-1.5 shrink-0 \${
                      activeTab === 'examinations'
                        ? 'bg-[#FF9100]/20 text-[#FF9100] border border-[#FF9100]/40 font-bold shadow-sm'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-[#16171c] border border-transparent'
                    }\`}
                  >
                    <Award className="w-3.5 h-3.5 text-[#FF9100]" />
                    <span>Examinations</span>
                  </button>

                  <button
                    role="tab"
                    aria-selected={activeTab === 'teams'}`;

  content = content.replace(assignmentsTabButtonMarker, examinationsTabButton);
  console.log('Added Examinations tab button.');
}

// 4. Add Examinations tab content
if (!content.includes("{/* TAB: Online Examinations */}")) {
  const teamsTabContentMarker = "{/* TAB: Project Teams & Formation Studio */}";
  const examinationsTabContent = `{/* TAB: Online Examinations */}
            {activeTab === 'examinations' && selectedClassroom && (
              <ExaminationsTab
                classroomId={selectedClassroom.id}
                isTeacher={currentUserRole === 'teacher'}
                currentUser={{
                  id: currentUserId,
                  name: currentUserName,
                  email: currentUserEmail,
                }}
              />
            )}

            {/* TAB: Project Teams & Formation Studio */}`;

  content = content.replace(teamsTabContentMarker, examinationsTabContent);
  console.log('Added Examinations tab content.');
}

fs.writeFileSync(targetFile, content, 'utf8');
console.log('Successfully patched src/app/classroom/page.tsx');
