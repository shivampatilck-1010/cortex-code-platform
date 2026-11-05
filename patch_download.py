import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = r"const handleRequestFileDownload = async \(ownerId: string, fileId: string\) => \{([\s\S]*?)\};"
repl = """const handleRequestFileDownload = async (ownerId: string, fileId: string) => {
    try {
      const owner = room?.participants[ownerId];
      if (!owner) throw new Error('Owner not found');
      
      const request = {
        id: 'dl_req_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
        requesterId: participantId,
        ownerId,
        fileId,
        status: 'pending',
        requestedAt: Date.now(),
      };
      
      const ownerName = owner.name || 'owner';
      showToast('Download permission requested from ' + ownerName + '! Waiting for response...');
      
      collabClientRef.current?.sendRaw({
        type: 'download_request',
        roomId,
        clientId: participantId,
        senderName: participantName,
        payload: { request },
        timestamp: Date.now(),
      });
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to request download'}`);
    }
  };"""

content = re.sub(pattern, repl, content)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
