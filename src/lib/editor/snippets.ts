/**
 * Monaco Editor Snippets & IntelliSense Completion Providers
 * Provides VS Code-like automatic completions and snippet expansions across all languages.
 */

export function registerMonacoSnippets(monaco: any): { dispose: () => void }[] {
  const disposables: { dispose: () => void }[] = [];

  // Helper to register snippets for a specific language
  const registerLang = (langId: string, items: any[]) => {
    try {
      const d = monaco.languages.registerCompletionItemProvider(langId, {
        provideCompletionItems: (model: any, position: any) => {
          const word = model.getWordUntilPosition(position);
          const range = {
            startLineNumber: position.lineNumber,
            endLineNumber: position.lineNumber,
            startColumn: word.startColumn,
            endColumn: word.endColumn,
          };

          return {
            suggestions: items.map((item) => ({
              ...item,
              range,
              kind: item.kind ?? monaco.languages.CompletionItemKind.Snippet,
              insertTextRules:
                item.insertTextRules ??
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            })),
          };
        },
      });
      disposables.push(d);
    } catch (e) {
      console.warn(`Failed to register completion provider for ${langId}:`, e);
    }
  };

  // 1. C++ (cpp)
  registerLang('cpp', [
    {
      label: 'for',
      detail: 'for loop (i = 0; i < n; ++i)',
      documentation: 'Standard indexed for loop',
      insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t$0\n}',
    },
    {
      label: 'forr',
      detail: 'range-based for loop',
      documentation: 'Iterate over elements in container',
      insertText: 'for (auto& ${1:item} : ${2:container}) {\n\t$0\n}',
    },
    {
      label: 'cout',
      detail: 'cout << ... << endl;',
      documentation: 'Stream standard output',
      insertText: 'cout << ${1:"Hello, World!"} << endl;',
    },
    {
      label: 'cin',
      detail: 'cin >> ...;',
      documentation: 'Stream standard input',
      insertText: 'cin >> ${1:variable};',
    },
    {
      label: 'struct',
      detail: 'struct declaration',
      documentation: 'Declare a struct data structure',
      insertText: 'struct ${1:Student} {\n\t${2:long regno;}\n\t${3:string name;}\n\t${4:int age;}\n\t$0\n};',
    },
    {
      label: 'class',
      detail: 'class declaration',
      documentation: 'Declare an object-oriented class',
      insertText: 'class ${1:ClassName} {\npublic:\n\t${1:ClassName}();\n\t~$1();\nprivate:\n\t$0\n};',
    },
    {
      label: 'main',
      detail: 'int main() entrypoint',
      documentation: 'Standard C++ main entrypoint',
      insertText: 'int main() {\n\t$0\n\treturn 0;\n}',
    },
    {
      label: 'while',
      detail: 'while loop',
      documentation: 'while (condition) loop',
      insertText: 'while (${1:condition}) {\n\t$0\n}',
    },
    {
      label: 'if',
      detail: 'if statement',
      documentation: 'Conditional if statement',
      insertText: 'if (${1:condition}) {\n\t$0\n}',
    },
    {
      label: 'ifelse',
      detail: 'if-else statement',
      documentation: 'Conditional if-else block',
      insertText: 'if (${1:condition}) {\n\t$2\n} else {\n\t$0\n}',
    },
    {
      label: 'vector',
      detail: 'std::vector declaration',
      documentation: 'Dynamic array vector',
      insertText: 'vector<${1:int}> ${2:vec};',
    },
    {
      label: 'include',
      detail: '#include <...>',
      documentation: 'Pre-processor include header',
      insertText: '#include <${1:iostream}>',
    },
    {
      label: 'include-all',
      detail: 'C++ standard boilerplate',
      documentation: 'iostream and namespace std boilerplate',
      insertText: '#include <iostream>\nusing namespace std;\n\nint main() {\n\t$0\n\treturn 0;\n}',
    },
  ]);

  // 2. C (c)
  registerLang('c', [
    {
      label: 'main',
      detail: 'int main(void)',
      documentation: 'C entrypoint function',
      insertText: 'int main(int argc, char *argv[]) {\n\t$0\n\treturn 0;\n}',
    },
    {
      label: 'printf',
      detail: 'printf("...", args);',
      documentation: 'Formatted console print',
      insertText: 'printf("${1:%s}\\n", ${2:str});',
    },
    {
      label: 'scanf',
      detail: 'scanf("...", &var);',
      documentation: 'Formatted console input',
      insertText: 'scanf("${1:%d}", &${2:var});',
    },
    {
      label: 'for',
      detail: 'for loop',
      documentation: 'Standard indexed for loop',
      insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ++${1:i}) {\n\t$0\n}',
    },
    {
      label: 'struct',
      detail: 'typedef struct',
      documentation: 'Typedef struct declaration',
      insertText: 'typedef struct {\n\t$0\n} ${1:Name_t};',
    },
    {
      label: 'include',
      detail: '#include <stdio.h>',
      documentation: 'Include standard I/O',
      insertText: '#include <stdio.h>',
    },
  ]);

  // 3. Python (python)
  registerLang('python', [
    {
      label: 'def',
      detail: 'def function_name(args):',
      documentation: 'Function definition',
      insertText: 'def ${1:function_name}(${2:args}):\n\t$0',
    },
    {
      label: 'main',
      detail: 'if __name__ == "__main__":',
      documentation: 'Python script entrypoint guard',
      insertText: 'def main():\n\t$0\n\nif __name__ == "__main__":\n\tmain()',
    },
    {
      label: 'print',
      detail: 'print(...)',
      documentation: 'Standard print statement',
      insertText: 'print(${1:f"${2:Result}: {${3:value}}"})',
    },
    {
      label: 'for',
      detail: 'for item in iterable:',
      documentation: 'For loop over collection or range',
      insertText: 'for ${1:i} in range(${2:10}):\n\t$0',
    },
    {
      label: 'while',
      detail: 'while condition:',
      documentation: 'While loop',
      insertText: 'while ${1:condition}:\n\t$0',
    },
    {
      label: 'class',
      detail: 'class ClassName:',
      documentation: 'Class definition with __init__',
      insertText: 'class ${1:ClassName}:\n\tdef __init__(self${2:, args}):\n\t\t$0',
    },
    {
      label: 'try',
      detail: 'try / except block',
      documentation: 'Exception handling block',
      insertText: 'try:\n\t$1\nexcept ${2:Exception} as ${3:e}:\n\tprint(f"Error: {${3:e}}")\n\t$0',
    },
    {
      label: 'if',
      detail: 'if condition:',
      documentation: 'Conditional statement',
      insertText: 'if ${1:condition}:\n\t$0',
    },
    {
      label: 'ifelse',
      detail: 'if / else block',
      documentation: 'If-else conditional block',
      insertText: 'if ${1:condition}:\n\t$2\nelse:\n\t$0',
    },
    {
      label: 'import',
      detail: 'import sys, os, math',
      documentation: 'Import common modules',
      insertText: 'import ${1:sys}',
    },
  ]);

  // 4. JavaScript & TypeScript (javascript, typescript)
  const jsTsSnippets = [
    {
      label: 'clg',
      detail: 'console.log(...)',
      documentation: 'Print to console',
      insertText: 'console.log(${1:item});',
    },
    {
      label: 'function',
      detail: 'function name(params) {}',
      documentation: 'Function declaration',
      insertText: 'function ${1:name}(${2:params}) {\n\t$0\n}',
    },
    {
      label: 'afn',
      detail: 'const name = () => {}',
      documentation: 'Arrow function expression',
      insertText: 'const ${1:name} = (${2:params}) => {\n\t$0\n};',
    },
    {
      label: 'for',
      detail: 'for (let i = 0; i < len; i++)',
      documentation: 'Standard indexed for loop',
      insertText: 'for (let ${1:i} = 0; ${1:i} < ${2:array}.length; ${1:i}++) {\n\t$0\n}',
    },
    {
      label: 'forof',
      detail: 'for (const item of iterable)',
      documentation: 'For..of collection loop',
      insertText: 'for (const ${1:item} of ${2:iterable}) {\n\t$0\n}',
    },
    {
      label: 'async',
      detail: 'async function',
      documentation: 'Asynchronous function',
      insertText: 'async function ${1:fetchData}(${2:url}) {\n\tconst res = await fetch(${2:url});\n\treturn res.json();\n}',
    },
    {
      label: 'try',
      detail: 'try / catch block',
      documentation: 'Catch runtime exceptions',
      insertText: 'try {\n\t$0\n} catch (${1:error}) {\n\tconsole.error(${1:error});\n}',
    },
    {
      label: 'class',
      detail: 'class Name {}',
      documentation: 'ES6 class declaration',
      insertText: 'class ${1:Name} {\n\tconstructor(${2:params}) {\n\t\t$0\n\t}\n}',
    },
  ];
  registerLang('javascript', jsTsSnippets);
  registerLang('typescript', jsTsSnippets);

  // 5. Java (java)
  registerLang('java', [
    {
      label: 'main',
      detail: 'public static void main(String[] args)',
      documentation: 'Java application main method',
      insertText: 'public static void main(String[] args) {\n\t$0\n}',
    },
    {
      label: 'sout',
      detail: 'System.out.println(...)',
      documentation: 'Print line to standard output',
      insertText: 'System.out.println(${1:"Hello, World!"});',
    },
    {
      label: 'class',
      detail: 'public class Main {}',
      documentation: 'Top-level Java class',
      insertText: 'public class ${1:Main} {\n\tpublic static void main(String[] args) {\n\t\t$0\n\t}\n}',
    },
    {
      label: 'for',
      detail: 'for (int i = 0; i < n; i++)',
      documentation: 'For loop',
      insertText: 'for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t$0\n}',
    },
  ]);

  // 6. Rust (rust)
  registerLang('rust', [
    {
      label: 'main',
      detail: 'fn main() {}',
      documentation: 'Rust binary main entrypoint',
      insertText: 'fn main() {\n\tprintln!("${1:Hello, World!}");\n\t$0\n}',
    },
    {
      label: 'println',
      detail: 'println!("...");',
      documentation: 'Formatted print macro',
      insertText: 'println!("${1:{}", ${2:val});',
    },
    {
      label: 'fn',
      detail: 'fn name(params) -> Type {}',
      documentation: 'Function declaration',
      insertText: 'fn ${1:name}(${2:params}) -> ${3:i32} {\n\t$0\n}',
    },
    {
      label: 'struct',
      detail: 'struct Name {}',
      documentation: 'Rust struct definition',
      insertText: '#[derive(Debug)]\nstruct ${1:Name} {\n\t$0\n}',
    },
  ]);

  // 7. Go (go)
  registerLang('go', [
    {
      label: 'main',
      detail: 'package main / func main()',
      documentation: 'Go application entrypoint',
      insertText: 'package main\n\nimport "fmt"\n\nfunc main() {\n\tfmt.Println("${1:Hello, World!}")\n\t$0\n}',
    },
    {
      label: 'fp',
      detail: 'fmt.Println(...)',
      documentation: 'Print line using fmt package',
      insertText: 'fmt.Println(${1:"Hello, World!"})',
    },
    {
      label: 'func',
      detail: 'func name(params) Type {}',
      documentation: 'Function declaration',
      insertText: 'func ${1:name}(${2:params}) ${3:error} {\n\t$0\n\treturn nil\n}',
    },
  ]);

  return disposables;
}
