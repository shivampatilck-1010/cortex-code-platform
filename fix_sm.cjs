
const fs = require("fs");
let sm = fs.readFileSync("src/components/modals/SettingsModal.tsx", "utf8");

const start = sm.indexOf("{/* Google Gemini AI Integration (Free API Key) */}");
const endStr = "</div>\\n              </div>\\n\\n              {/* Environment Information */}";
const end = sm.indexOf("{/* Environment Information */}");

if(start !== -1 && end !== -1) {
  const replacement = \`{/* Google Gemini AI Integration (Server Managed) */}
                <div className="bg-[#151722] border border-[#2d303f] rounded-lg p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-xs flex items-center space-x-1.5 text-[#ff9100]">
                      <Sparkles className="w-4 h-4 text-[#ff9100]" />
                      <span>Cortex AI Integration</span>
                    </span>
                    <span className="text-[#10b981] text-[10.5px] flex items-center space-x-1">
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Connected to Server</span>
                    </span>
                  </div>
                  <p className="text-gray-300 text-[11px] leading-relaxed">
                    Cortex uses a secure server-managed Google Gemini integration for complex algorithmic analysis and deep code repairs across all 16 languages. Your requests are routed securely through the Cortex API.
                  </p>
                </div>
              </div>

              \`;
  sm = sm.substring(0, start) + replacement + sm.substring(end);
  fs.writeFileSync("src/components/modals/SettingsModal.tsx", sm);
  console.log("Fixed SettingsModal");
} else {
  console.log("Could not find start or end");
}

