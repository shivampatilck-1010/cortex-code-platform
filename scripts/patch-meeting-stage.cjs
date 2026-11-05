const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../src/components/live-class/modules/meeting/MeetingStageModule.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Destructure currentUserName and remoteStreams from useClassroom
content = content.replace(
  `    muteStudent,
    turnOffStudentCamera,
    requestStudentUnmute,
    requestStudentCamera,
  } = useClassroom();`,
  `    muteStudent,
    turnOffStudentCamera,
    requestStudentUnmute,
    requestStudentCamera,
    currentUserName,
    remoteStreams,
  } = useClassroom();`
);

// 2. Replace hardcoded user names in Local User Camera Off State
content = content.replace(
  `{formatInitials(userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen')}`,
  `{formatInitials(currentUserName || (userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'))}`
);

content = content.replace(
  `{userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'} (You)`,
  `{(currentUserName || (userRole === 'teacher' ? 'Prof. Shivam Patil' : 'Alex Chen'))} (You)`
);

// 3. Replace Remote Simulated Participant Focus block with real remote video stream support or clean profile
const remoteTarget = `            ) : (
              /* Condition 3: Remote Simulated Participant Focus */
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="relative mb-4">
                  <div className="w-28 h-28 rounded-full bg-[#1D1F27] border-2 border-[#FF9100] flex items-center justify-center shadow-lg relative z-10">
                    <span className="text-2xl font-bold text-white tracking-wider">
                      {formatInitials(activeSpeaker.name)}
                    </span>
                  </div>
                  <div className="absolute inset-0 -m-3 rounded-full border border-[#FF9100]/40 animate-ping opacity-30" />
                </div>

                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-semibold text-white">{activeSpeaker.name}</h3>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#FF9100]/15 text-[#FF9100] border border-[#FF9100]/30">
                    Simulated Peer Feed
                  </span>
                </div>
                <span className="text-xs text-[#FF9100] font-medium uppercase tracking-wider mt-0.5">
                  {activeSpeaker.role === 'teacher' ? 'Course Instructor' : 'Student Participant'}
                </span>

                <div className="mt-4 flex items-center space-x-2 text-xs text-[#A1A1AA] bg-[#15161C] px-3 py-1.5 rounded-full border border-[#282A36]">
                  <Volume2 className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Speaking: "Analyzing balance factor during AVL left-right double rotation"</span>
                </div>
              </div>
            )}`;

const remoteReplacement = `            ) : (
              /* Condition 3: Remote Participant Focus */
              remoteStreams && remoteStreams.has(activeSpeaker.id) && !activeSpeaker.isVideoOff ? (
                <div className="w-full h-full relative flex items-center justify-center bg-black">
                  <video
                    ref={(el) => {
                      if (el && remoteStreams.get(activeSpeaker.id) && el.srcObject !== remoteStreams.get(activeSpeaker.id)) {
                        el.srcObject = remoteStreams.get(activeSpeaker.id) || null;
                        el.play().catch(() => {});
                      }
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-4 left-4 flex items-center space-x-2 bg-black/75 backdrop-blur px-2.5 py-1 rounded-md border border-[#FF9100]/40 text-xs text-white">
                    <span className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse" />
                    <span>Live Video ({activeSpeaker.name})</span>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="relative mb-4">
                    <div className="w-28 h-28 rounded-full bg-[#1D1F27] border-2 border-[#FF9100] flex items-center justify-center shadow-lg relative z-10">
                      <span className="text-2xl font-bold text-white tracking-wider">
                        {formatInitials(activeSpeaker.name)}
                      </span>
                    </div>
                    {!activeSpeaker.isMuted && (
                      <div className="absolute inset-0 -m-3 rounded-full border border-[#10B981]/50 animate-ping opacity-40" />
                    )}
                  </div>

                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-semibold text-white">{activeSpeaker.name}</h3>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#10B981]/15 text-[#10B981] border border-[#10B981]/30">
                      {activeSpeaker.connectionStatus === 'connected' ? 'Connected' : 'Offline'}
                    </span>
                  </div>
                  <span className="text-xs text-[#FF9100] font-medium uppercase tracking-wider mt-0.5">
                    {activeSpeaker.role === 'teacher' ? 'Course Instructor' : 'Student Participant'}
                  </span>

                  <div className="mt-4 flex items-center space-x-2 text-xs text-[#A1A1AA] bg-[#15161C] px-3.5 py-1.5 rounded-full border border-[#282A36]">
                    {activeSpeaker.isMuted ? (
                      <>
                        <MicOff className="w-3.5 h-3.5 text-[#EF4444]" />
                        <span>Microphone is currently muted</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="w-3.5 h-3.5 text-[#10B981]" />
                        <span>Microphone active</span>
                      </>
                    )}
                  </div>
                </div>
              )
            )}`;

content = content.replace(remoteTarget, remoteReplacement);

// 4. In Grid Gallery tiles, eliminate "Simulated peer participant"
content = content.replace(
  `<p className="text-[10px] text-[#71717A] truncate">
                          Simulated peer participant
                        </p>`,
  `<p className="text-[10px] text-[#71717A] truncate">
                          {p.role === 'teacher' ? 'Course Instructor' : 'Student Participant'}
                        </p>`
);

fs.writeFileSync(filePath, content);
console.log('MeetingStageModule.tsx successfully patched.');
