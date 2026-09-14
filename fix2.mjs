import fs from 'fs';
let code = fs.readFileSync('scripts/test-phase2i-a.mjs', 'utf8');

// Fix createSubmission URL
code = code.replace(/\/assignments\/\/submit/g, '/assignments/${assignmentId}/submit');
code = code.replace(/\/assignments\/\$\{assignmentId\}\/submit/g, '/assignments/${assignmentId}/submit');

// Fix C1 json parsing
code = code.replace(/await projRes\.json\(\)/g, 'await projRes.text().then(t => { try { return JSON.parse(t); } catch(e) { return { _raw: t }; } })');

fs.writeFileSync('scripts/test-phase2i-a.mjs', code);
