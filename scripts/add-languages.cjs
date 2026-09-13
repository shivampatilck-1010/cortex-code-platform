const fs = require('fs');
const path = 'src/app/classroom/[roomId]/assignments/builder/[asgId]/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const selectRegex = /<select\s+value=\{language\} onChange=\{\(e\) => setLanguage\(e\.target\.value\)\}\s+className="w-full bg-\[\#13141a\] border border-\[\#252830\] rounded-xl px-4 py-3 text-white \n?focus:border-\[\#ff9100\] outline-none"\s*>[\s\S]*?<\/select>/;

const newSelect = `<select 
                      value={language} onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-[#13141a] border border-[#252830] rounded-xl px-4 py-3 text-white focus:border-[#ff9100] outline-none"
                    >
                      <option value="python">Python 3</option>
                      <option value="javascript">JavaScript (Node)</option>
                      <option value="typescript">TypeScript</option>
                      <option value="cpp">C++</option>
                      <option value="c">C</option>
                      <option value="java">Java</option>
                      <option value="csharp">C#</option>
                      <option value="go">Go</option>
                      <option value="rust">Rust</option>
                      <option value="php">PHP</option>
                      <option value="ruby">Ruby</option>
                      <option value="kotlin">Kotlin</option>
                      <option value="swift">Swift</option>
                      <option value="r">R</option>
                      <option value="dart">Dart</option>
                      <option value="sql">SQL</option>
                    </select>`;

if (selectRegex.test(content)) {
    content = content.replace(selectRegex, newSelect);
    fs.writeFileSync(path, content);
    console.log("Success");
} else {
    console.log("Regex not matched");
}
