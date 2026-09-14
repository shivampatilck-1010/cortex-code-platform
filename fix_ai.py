
c = open("src/lib/ai/assistant.ts", "r", encoding="utf-8").read()
c = c.replace("process.env.NEXT_PUBLIC_GEMINI_KEY || ", "")
open("src/lib/ai/assistant.ts", "w", encoding="utf-8").write(c)

