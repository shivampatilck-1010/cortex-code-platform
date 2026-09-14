import os
import re

files_to_check = [
    'src/lib/classroom/db/index.ts',
    'src/lib/project/db/index.ts',
    'src/lib/arena/db/index.ts'
]

schema = []

for f in files_to_check:
    c = open(f, 'r', encoding='utf-8').read()
    # Replace all string delimiters with standard text to extract SQL statements easily
    c = c.replace('', '\"')
    
    # We can just extract everything that looks like a CREATE TABLE
    # A bit hard...
