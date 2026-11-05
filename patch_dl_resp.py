import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"const handleRespondDownload = async \(requestId: string, decision: FileDownloadDecision\) => \{([\s\S]*?)\};"
repl = """const handleRespondDownload = async (requestId: string, decision: FileDownloadDecision) => {
    const req = incomingDownloadReq;
    setIncomingDownloadReq(null);
    if (!req) return;
    
    collabClientRef.current?.sendRaw({
      type: 'download_response',
      roomId,
      clientId: participantId,
      senderName: participantName,
      payload: {
        request: {
          ...req,
          status: decision
        }
      },
      timestamp: Date.now(),
    });
  };"""

content = re.sub(pattern, repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
