# Cortex Online Examination System — Phase 3.9.1 Safe Exam Browser Protocol Audit

## 1. Executive Summary & Audit Scope

This audit evaluates the Safe Exam Browser (SEB) cryptographic verification protocol in `src/lib/classroom/seb-security.ts` and resolves discrepancies between SHA-256 concatenation and HMAC-SHA256 references in previous documentation.

---

## 2. Cryptographic Protocol Reconciliation: SHA-256 vs. HMAC-SHA256

Previous audit documents colloquially referred to SEB header validation as "HMAC-SHA256".

Section 10 of the Master Execution Prompt mandates an independent technical reconciliation:
> "Resolve any discrepancy between SHA-256-based Browser Exam Key/Config Key derivation and HMAC-based validation claims. Do not assume that two cryptographic approaches are interchangeable."

### Empirical Proof of Discrepancy
An automated comparison was executed via `scripts/audit-phase3-9-1-seb.ts`:
* Target URL: `https://cortex.edu/exams/exam_123`
* Key: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef`
* **SEB Standard `SHA256(URL + Key)`**: `c5c006bcc2c64f98bb7f5dda72507fa34050cdad9ab4e69f30820a2b30c926ae`
* **RFC 2104 `HMAC-SHA256(Key, URL)`**: `23f76a23ec3d7074420089e24a7d21c160ee519df16d812bb2c28f02399fecf9`

The two cryptographic operations produce entirely different digests.

### Official Safe Exam Browser Specification
According to the official Safe Exam Browser Integration Specification (ETH Zurich / SEB Consortium):
* `X-SafeExamBrowser-RequestHash = SHA256(RequestURL + BrowserExamKey)`
* `X-SafeExamBrowser-ConfigKeyHash = SHA256(RequestURL + ConfigKey)`

### Verdict
The actual implementation in `src/lib/classroom/seb-security.ts`:
```typescript
export function computeSafeExamBrowserHash(url: string, key: string): string {
  return crypto.createHash('sha256').update(url + key).digest('hex').toLowerCase();
}
```
**Correctly follows the official SEB specification**. The code was already using standard SHA-256 string concatenation. The terminology in documentation has now been corrected from "HMAC-SHA256" to "SHA-256 concatenation with key".

---

## 3. Canonical URL Handling & Host Validation

SEB clients compute hashes based on the exact URL requested by the browser engine. Discrepancies often arise from:
* Standard port numbers (e.g. `:80` or `:443`).
* Reverse proxy host headers (`x-forwarded-host`).
* Trailing slashes (`/exams/test` vs `/exams/test/`).

### Verification of `generateCandidateUrls`
* Standard ports 80 and 443 are stripped per the SEB specification.
* Trailing slashes are expanded to test both slash-terminated and non-slash variants.
* Host headers are filtered against `isTrustedHost()` to prevent Host Header Poisoning or arbitrary canonical injection.

---

## 4. Native Desktop Reality & Track C Scope Boundary

* **Web / Simulated Mode**: Validated and fully functional. Correctly rejects missing or tampered headers.
* **Native Desktop Client**: An HTTP server cannot prove that a candidate's local operating system has blocked keystrokes (Alt+Tab, PrintScreen, WinKey) or killed unauthorized processes unless tested on physical Windows and macOS hardware running the official signed SEB binary.
* **Production Boundary**: Track C (Native Desktop SEB) remains **EXCLUDED / NO-GO** for the initial production launch. Standard browser exams with web-level focus tracking, fullscreen lock, and tab-switch integrity logging (Track A) are production-ready.
