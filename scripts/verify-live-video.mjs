async function verify() {
  const pageRes = await fetch("https://cortex-code-platform-staging.cortexbuild1.workers.dev");
  console.log("Landing page status:", pageRes.status);
  const html = await pageRes.text();
  console.log("Contains Cortex in Motion:", html.includes("Cortex in Motion"));
  console.log("Contains showcase section:", html.includes("showcase"));

  const videoHead = await fetch("https://cortex-code-platform-staging.cortexbuild1.workers.dev/videos/finalcortex.mp4", { method: "HEAD" });
  console.log("Video HEAD status:", videoHead.status);
  console.log("Content-Type:", videoHead.headers.get("content-type"));
  console.log("Content-Length:", videoHead.headers.get("content-length"));
  console.log("Accept-Ranges:", videoHead.headers.get("accept-ranges"));

  const videoRange = await fetch("https://cortex-code-platform-staging.cortexbuild1.workers.dev/videos/finalcortex.mp4", {
    headers: { Range: "bytes=0-1023" }
  });
  console.log("Video Range status:", videoRange.status);
  console.log("Content-Range:", videoRange.headers.get("content-range"));
  const buf = await videoRange.arrayBuffer();
  console.log("Range body length:", buf.byteLength);

  const part0Res = await fetch("https://cortex-code-platform-staging.cortexbuild1.workers.dev/videos/finalcortex.part0.mp4", { method: "HEAD" });
  console.log("Part 0 status:", part0Res.status, "Length:", part0Res.headers.get("content-length"));
  const part1Res = await fetch("https://cortex-code-platform-staging.cortexbuild1.workers.dev/videos/finalcortex.part1.mp4", { method: "HEAD" });
  console.log("Part 1 status:", part1Res.status, "Length:", part1Res.headers.get("content-length"));
}
verify().catch(console.error);
