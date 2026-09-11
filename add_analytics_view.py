import re

with open('src/app/classroom/page.tsx', 'r') as f:
    content = f.read()

analytics_view = """
            {/* TAB 9: Teacher Analytics */}
            {activeTab === 'analytics' && currentUserRole === 'teacher' && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <div className="flex items-center justify-between border-b border-[#20222d] pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-white tracking-tight">Classroom Analytics Overview</h3>
                    <p className="text-xs text-gray-400 mt-1">High-level view of student engagement and performance</p>
                  </div>
                  <button className="px-3 py-1.5 bg-[#1d1f2a] hover:bg-[#282a38] text-gray-300 text-xs font-medium rounded-md border border-[#2d3142] transition shadow-sm">
                    Export CSV Report
                  </button>
                </div>

                {analytics ? (
                  <div className="space-y-6">
                    {/* Top Level KPIs */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <Users className="w-12 h-12 text-[#ff9100]" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Active Students</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.totalStudents}</span>
                        </div>
                      </div>
                      
                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Average Score</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.averageScore}%</span>
                          <span className="text-[10px] text-emerald-400 font-medium mb-1">+2.4%</span>
                        </div>
                      </div>

                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <Activity className="w-12 h-12 text-blue-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Completion Rate</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-white tracking-tighter">{analytics.completionRate}%</span>
                        </div>
                      </div>

                      <div className="bg-[#13141a] border border-[#20222d] p-5 rounded-xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:border-[#323648] transition">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                          <AlertTriangle className="w-12 h-12 text-amber-500" />
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1 z-10">Students At Risk</span>
                        <div className="flex items-end space-x-2 z-10">
                          <span className="text-3xl font-extrabold text-amber-400 tracking-tighter">{analytics.atRiskCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Submissions Trend */}
                      <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-[#20222d] bg-[#161720]">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Recent Submissions Trend</h4>
                        </div>
                        <div className="p-6 flex-1 flex flex-col items-center justify-center min-h-[250px]">
                          {/* Visualization stub */}
                          <div className="w-full flex items-end justify-between h-40 gap-2">
                            {[35, 45, 30, 60, 80, 50, 90, 75, 40, 65, 85, 100].map((val, i) => (
                              <div key={i} className="w-full bg-[#1e202b] rounded-t-sm relative group transition-all duration-300 hover:bg-[#2d3142]" style={{ height: '100%' }}>
                                <div 
                                  className="absolute bottom-0 w-full bg-[#ff9100] rounded-t-sm opacity-80 group-hover:opacity-100 transition-all duration-300"
                                  style={{ height: `${val}%` }}
                                ></div>
                              </div>
                            ))}
                          </div>
                          <div className="w-full flex justify-between text-[10px] text-gray-500 font-mono mt-3 uppercase tracking-widest">
                            <span>2W Ago</span>
                            <span>Today</span>
                          </div>
                        </div>
                      </div>

                      {/* Active Submissions List */}
                      <div className="bg-[#13141a] border border-[#20222d] rounded-xl overflow-hidden flex flex-col shadow-sm">
                        <div className="p-4 border-b border-[#20222d] bg-[#161720]">
                          <h4 className="text-xs font-bold text-white uppercase tracking-wider">Top Performing Students</h4>
                        </div>
                        <div className="p-0 overflow-y-auto max-h-[300px]">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-[#171821] border-b border-[#20222d] text-gray-400 uppercase tracking-wider text-[10px] sticky top-0">
                              <tr>
                                <th className="px-5 py-3 font-semibold">Student Name</th>
                                <th className="px-5 py-3 font-semibold text-right">Avg Score</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#1e202b] text-gray-300">
                              {leaderboard.slice(0, 5).map((l, i) => (
                                <tr key={l.studentId} className="hover:bg-[#181922] transition group">
                                  <td className="px-5 py-3 font-medium flex items-center space-x-3">
                                    <span className="w-5 h-5 rounded-full bg-[#1e202b] flex items-center justify-center text-[9px] font-bold text-gray-400 group-hover:text-[#ff9100] transition">
                                      {i + 1}
                                    </span>
                                    <span>{l.studentName}</span>
                                  </td>
                                  <td className="px-5 py-3 font-mono font-bold text-emerald-400 text-right">{l.accuracy}%</td>
                                </tr>
                              ))}
                              {leaderboard.length === 0 && (
                                <tr>
                                  <td colSpan={2} className="px-5 py-8 text-center text-gray-500 italic">No student performance data available yet.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                    <BarChart2 className="w-12 h-12 mb-4 opacity-20" />
                    <p>Analytics data is not yet available for this classroom.</p>
                  </div>
                )}
              </div>
            )}
"""

content = content.replace("{/* TAB 8: Settings (Teacher only) */}", analytics_view + "\n            {/* TAB 8: Settings (Teacher only) */}")

with open('src/app/classroom/page.tsx', 'w') as f:
    f.write(content)
