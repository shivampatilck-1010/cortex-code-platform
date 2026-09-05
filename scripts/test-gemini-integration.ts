import { executeInLocalSandbox } from '../src/lib/execution/local-sandbox';

async function runTests() {
  console.log('=================================================================');
  console.log('[TESTS] GEMINI AI INTEGRATION & AUTOMATED CONNECTION TEST SUITE');
  console.log('=================================================================\n');

  const validKey = process.env.GEMINI_API_KEY || '';
  const invalidKey = 'AIzaSyFakeKeyInvalid1234567890';


  // Test 1: Verify Valid Key via API
  console.log('=== 1. Testing API Key Verification with Valid Key ===');
  const verifyRes = await fetch('http://localhost:3000/api/v1/ai/verify-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: validKey }),
  });
  const verifyData = await verifyRes.json();
  console.log('Status:', verifyRes.status);
  console.log('Response:', JSON.stringify(verifyData));
  if (verifyData.valid && verifyData.message === 'Your auto fix is connected and good to go!') {
    console.log('[PASS] Valid key correctly verified with success message!\n');
  } else {
    console.error('[FAIL] Valid key check failed!\n');
  }

  // Test 2: Verify Invalid Key via API
  console.log('=== 2. Testing API Key Verification with Invalid Key ===');
  const badRes = await fetch('http://localhost:3000/api/v1/ai/verify-key', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey: invalidKey }),
  });
  const badData = await badRes.json();
  console.log('Status:', badRes.status);
  console.log('Response:', JSON.stringify(badData));
  if (!badData.valid && badData.error) {
    console.log('[PASS] Invalid key correctly rejected with error message!\n');
  } else {
    console.error('[FAIL] Invalid key was not rejected properly!\n');
  }

  // Test 3: Auto-Fix endpoint with the C++ Student snippet using Gemini AI
  console.log('=== 3. Testing Auto-Fix API with Gemini AI on C++ Student Snippet ===');
  const userCppCode = `#include<iostream>
using namespace std;
struct Student{
    long regno;
    string name;
    int age;
    Student(long r, string n, int a){
        regno=r;
        name=n;
        age=a;
    }
};
int main(){
    Student s[5]={
        Student(1001,"Alice",20),
        Student(1002,"Bob",21),
        Student(1003,"Charlie",19),
        Student(1004,"David",22),
        Student(1005,"Eve",20)
    };
    cout<<"Student Details:"<<endl;
    for(int i=0; i<5; i++){
        cout<<"Student "<<i+1<<":"<<endl;
        cout<<"Registration Number: "<<s[i].regno<<endl;
        cout<<"Name: "<<s[i].name<<en
        cout<<"Age: "<<s[i].age<<endl;
    }
}`;

  const stderr = `test_student.cpp: In function 'int main()':
test_student.cpp:25:36: error: 'en' was not declared in this scope; did you mean 'endl'?
   25 |         cout<<"Name: "<<s[i].name<<en
      |                                    ^~
      |                                    endl`;

  const fixRes = await fetch('http://localhost:3000/api/v1/ai/autofix', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: userCppCode,
      stderr,
      languageId: 'cpp',
      apiKey: validKey,
    }),
  });
  const fixData = await fixRes.json();
  console.log('Auto-Fix Status:', fixRes.status);
  console.log('Provider:', fixData.provider);
  console.log('Model:', fixData.model);
  console.log('Target Line:', fixData.fix?.targetLine);
  console.log('Cause:', fixData.fix?.cause);
  console.log('Inline Comment:', fixData.fix?.inlineComment);
  console.log('Fixed Snippet:', fixData.fix?.fixedSnippet);

  // Test 4: Verify that the repaired code executes in G++ with 0 errors
  console.log('\n=== 4. Verifying G++ Execution of the Gemini-Fixed Code ===');
  const execRes = await executeInLocalSandbox({
    language: 'cpp',
    files: [{ id: '1', name: 'main.cpp', path: '/main.cpp', content: fixData.fix?.fixedCode }],
  });
  console.log('Execution Status:', execRes.status);
  console.log('Exit Code:', execRes.exitCode);
  console.log('Stdout:\n' + execRes.stdout.trim());

  if (execRes.status === 'success' && execRes.exitCode === 0) {
    console.log('\n[PASS] All 5 students printed with exit code 0! Complete Success!');
  } else {
    console.error('\n[FAIL] G++ execution failed!');
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
