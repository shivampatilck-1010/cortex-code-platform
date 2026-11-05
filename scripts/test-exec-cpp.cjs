async function test() {
  const cppCode = `#include <iostream>
int main() {
    std::cout << "C++ 14.1.0 OK" << std::endl;
    return 0;
}`;

  const res = await fetch('https://cortex-code-platform.cortexbuild1.workers.dev/api/v1/execute', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      language: 'cpp',
      files: [{ id: 'main', name: 'main.cpp', content: cppCode }]
    })
  });
  const data = await res.json();
  console.log('C++ Execution Result:', data);
}
test();
