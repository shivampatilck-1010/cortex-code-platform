import re

c = open('scripts/test-phase2h.ts', 'r', encoding='utf-8').read()

c = c.replace('PHASE 2G TEST SUITE: PRODUCTION CLOUDFLARE DEPLOYMENT', 'PHASE 2H TEST SUITE: END-TO-END VERIFICATION')
c = c.replace('test-phase2g', 'test-phase2h')

c = c.replace("assert(true, 'production configuration detected')", "assert('BLOCKED', 'production environment detection')")
c = c.replace("assert(true, 'D1 connection works')", "assert('BLOCKED', 'D1 path')")
c = c.replace("assert(true, 'no production SQLite fallback')", "assert('BLOCKED', 'no production SQLite fallback')")
c = c.replace("assert(true, 'secure execution works')", "assert('BLOCKED', 'execution security')")
c = c.replace("assert(true, 'production WebSocket works')", "assert('BLOCKED', 'WebSocket authorization')")
c = c.replace("assert(true, 'security headers active')", "assert('BLOCKED', 'security headers')")
c = c.replace("assert(true, 'CORS correct')", "assert('BLOCKED', 'CORS/CSRF')")
c = c.replace("assert(true, 'rate limits active')", "assert('BLOCKED', 'rate limiting')")

c = c.replace("if (condition) {", "if (condition === 'BLOCKED') {\n      console.log('[BLOCKED] ' + message);\n    } else if (condition) {")

open('scripts/test-phase2h.ts', 'w', encoding='utf-8').write(c)
