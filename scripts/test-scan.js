#!/usr/bin/env bun
// Usage: bun scripts/test-scan.js
// Requires TEST_SESSION_TOKEN in .env (copy from DevTools → Application → Cookies → better-auth.session_token)


const token = process.env.TEST_SESSION_TOKEN;
if (!token) {
  console.error("Missing TEST_SESSION_TOKEN in .env");
  console.error("Get it from: DevTools → Application → Cookies → better-auth.session_token");
  process.exit(1);
}

const base = process.env.BETTER_AUTH_URL ?? "http://localhost:8787";
const pageToken = process.argv[2];
const url = `${base}/api/gmail/scan${pageToken ? `?pageToken=${pageToken}` : ""}`;

console.log(`GET ${url}`);

let res;
try {
  res = await fetch(url, {
    headers: { Cookie: `better-auth.session_token=${token}` },
  });
} catch (err) {
  console.error("Network error:", err);
  process.exit(1);
}

const body = await res.text();
console.log("Status:", res.status);

if (!res.ok) {
  console.error("Error:", body);
  process.exit(1);
}

const data = JSON.parse(body);
console.log("Result:", data);
console.log(`  processed:     ${data.processed}`);
console.log(`  skipped:       ${data.skipped}`);
if (data.nextPageToken) console.log(`  nextPageToken: ${data.nextPageToken}`);
