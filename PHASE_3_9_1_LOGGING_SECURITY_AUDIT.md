# Cortex Online Examination System — Phase 3.9.1 Structured Logging Redaction Audit

## 1. Executive Summary & Audit Scope

This audit evaluates the resilience and coverage of the data redaction engine implemented in `src/lib/classroom/logger.ts` (`redactSensitiveData` and `CortexLogger`).

While basic keys such as `password`, `token`, and `seb_quit_password` are masked, empirical testing reveals multiple leak vectors when sensitive data is embedded within URL strings, raw cookie headers, or non-standard payload fields.

---

## 2. Empirical Test Findings & Leak Reproductions

The audit script `scripts/audit-phase3-9-1-logging.ts` tested 4 core scenarios:

### Finding 1: URL Query Parameter Secrets Unredacted [Severity: High]
* **Vulnerability**: URLs logged in query context or error reports containing query parameters (e.g., `?token=...`, `&api_key=...`, `&secret=...`) are logged in cleartext.
* **Reproduction**:
  `{ requestUrl: "https://cortex.edu/callback?token=secret_jwt_token_12345&api_key=ak_987654321" }`
  Output: Left unchanged in JSON log.
* **Root Cause**: Redaction string inspection only matched the literal string `bearer `.

### Finding 2: Session Cookie Strings in Non-Standard Keys [Severity: Medium]
* **Vulnerability**: Raw cookie strings (e.g. `cortex_session=<token>`) placed in arbitrary fields such as `rawHeader`, `cookieString`, or error contexts are not redacted.
* **Reproduction**:
  `{ rawHeader: "cortex_session=e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855; Path=/" }`
  Output: The 64-character session token was logged in cleartext.
* **Root Cause**: `SENSITIVE_KEYS` only matches dictionary property names, not values formatted as cookie strings.

### Finding 3: Student Candidate Code & Subjective Answers in Logs [Severity: Medium]
* **Vulnerability**: Candidate examination answers containing student code (`rawCode`) or subjective text (`subjectiveText`) can be serialized in logs during error handling.
* **Root Cause**: `SENSITIVE_KEYS` lacks answer/response payload keys (`rawcode`, `subjectivetext`, `studentresponse`, `answertext`).

### Finding 4: Circular Reference Handling [Status: Passed]
* **Result**: Tested circular object `obj.self = obj`. The depth check `if (depth > 8) return '[MAX_DEPTH_REACHED]'` prevented infinite recursion without throwing exceptions.

---

## 3. Required Remediation Architecture (Phase 3.9.2)

1. **Enhanced String Redaction (Regex for URLs & Cookies)**:
   Add regex rules in `redactSensitiveData` for:
   - URL query parameters: `/(token|key|secret|password|auth|code)=([^&\s]+)/gi` -> `$1=[REDACTED]`.
   - Cookie assignments: `/(cortex_session|session|jwt|auth)=([^;\s]+)/gi` -> `$1=[REDACTED]`.
2. **Expanded `SENSITIVE_KEYS` Dictionary**:
   Include: `rawcode`, `subjectivetext`, `studentresponse`, `studentanswer`, `answertext`, `selectedoptionid`, `apikey`, `api_key`.
3. **Structured Log Attributes Enforcement**:
   Ensure all emitted logs strictly include `timestamp`, `isoTime`, `level`, `message`, `correlationId`, and `eventType`.
