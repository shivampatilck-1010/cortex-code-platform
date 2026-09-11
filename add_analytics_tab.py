import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

analytics_btn = """
              {currentUserRole === 'teacher' && (
                <button
                  onClick={() => setActiveTab('analytics')}
                  className={`h-full border-b-2 font-medium transition flex items-center space-x-2 shrink-0 ${
                    activeTab === 'analytics'
                      ? 'border-[#ff9100] text-white font-semibold'
                      : 'border-transparent text-gray-400 hover:text-gray-200'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Teacher Analytics</span>
                </button>
              )}
"""

content = content.replace("              {currentUserRole === 'teacher' && (\n                <button\n                  onClick={() => setActiveTab('settings')}", analytics_btn + "              {currentUserRole === 'teacher' && (\n                <button\n                  onClick={() => setActiveTab('settings')}")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)
