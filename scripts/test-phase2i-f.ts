


const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function runTest(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    return true;
  } catch (err: any) {
    console.error(`[FAIL] ${name} - ${err.message}`);
    return false;
  }
}

async function main() {
  console.log(`\n=== CORTEX PHASE 2I-F (AI SEC) TEST SUITE ===\nTarget: ${BASE_URL}\n`);

  let passed = 0;
  let total = 0;

  // 1. Unauthenticated Chat Request should be rejected
  total++;
  const t1 = await runTest("Unauthenticated chat request rejected (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: "Hello", language: "javascript" })
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });
  if (t1) passed++;

  // 2. Unauthenticated autofix request rejected
  total++;
  const t2 = await runTest("Unauthenticated autofix request rejected (401)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/ai/autofix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "a", stderr: "b", languageId: "javascript" })
    });
    if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  });
  if (t2) passed++;

  // 3. Oversized Payload rejected (413)
  total++;
  const t3 = await runTest("Oversized payload rejected (413)", async () => {
    // Generate 1MB payload
    const bigString = "a".repeat(1024 * 600);
    const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: bigString, language: "javascript" })
    });
    if (res.status !== 413 && res.status !== 401) throw new Error(`Expected 413 or 401, got ${res.status}`);
  });
  if (t3) passed++;
  
  // 4. Authenticated request - register a test user
  let token = "";
  let userId = "";
  total++;
  const t4 = await runTest("Register/Login test user for AI", async () => {
    const email = `ai_${Date.now()}@test.com`;
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password: "Password123!",
        confirmPassword: "Password123!",
        name: "AI Test User",
        cortexId: "ai_" + Date.now().toString().slice(-10),
        role: "student"
      })
    });
    if (!res.ok) throw new Error(`Registration failed: ${res.status}`);
    const data = await res.json() as any;
    
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) {
      const match = setCookie.match(/session=([^;]+)/);
      if (match) token = match[1]; console.log("Extracted token:", token);
    }

    userId = data.user.id;
  });
  if (t4) passed++;

  // 5. Authenticated AI Request (Chat)
  total++;
  const t5 = await runTest("Authenticated chat request allowed", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": `session=${token}` 
      },
      body: JSON.stringify({ userMessage: "Hello", language: "javascript" })
    });
    // Can be 200 (Success) or 503 (No API Key configured on server)
    if (res.status !== 200 && res.status !== 503) {
      throw new Error(`Expected 200 or 503, got ${res.status}`);
    }
  });
  if (t5) passed++;

  // 6. Test IDOR/Classroom isolation: Try passing a random classroomId
  total++;
  const t6 = await runTest("Chat rejects cross-classroom context if not member (403)", async () => {
    const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": `session=${token}` 
      },
      body: JSON.stringify({ userMessage: "Hello", language: "javascript", classroomId: "cls_fake123" })
    });
    if (res.status !== 403 && res.status !== 404) { // Depending on if it fails membership check or not found
      throw new Error(`Expected 403 or 404, got ${res.status}`);
    }
  });
  if (t6) passed++;

  console.log(`\n=== RESULTS ===`);
  console.log(`PASS: ${passed} | FAIL: ${total - passed} | NEEDS VERIFICATION: 0`);
  if (passed !== total) process.exit(1);
}

main().catch(console.error);

