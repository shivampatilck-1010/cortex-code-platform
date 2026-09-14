
c = open(".gitignore", "rb").read()
# Try decoding as utf-16
try:
    c = c.decode("utf-16").replace("\r", "")
except:
    # already ok, but let us just read it correctly
    c = open(".gitignore", "r", encoding="utf-8", errors="ignore").read()
open(".gitignore", "w", encoding="utf-8").write(c)

