
import os
content = open("migrations/0001_initial_schema.sql", "r", encoding="utf-8").read()
import re
content = re.sub(r"ALTER TABLE.*?;", "", content)
open("migrations/0001_initial_schema.sql", "w", encoding="utf-8").write(content)

