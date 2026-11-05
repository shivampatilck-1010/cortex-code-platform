import re

file_path = "src/app/classroom/[roomId]/page.tsx"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("      });\n      }\n      collabClientRef.current?.triggerImmediateSync();\n    } catch (err: any) {", "      });\n      collabClientRef.current?.triggerImmediateSync();\n    } catch (err: any) {")

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)
