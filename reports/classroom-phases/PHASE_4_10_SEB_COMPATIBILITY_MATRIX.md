# PHASE 4.10: SAFE EXAM BROWSER COMPATIBILITY MATRIX

**Document Version**: 1.0.0  
**Target Architecture**: Multi-Platform Safe Exam Browser Client Verification  
**Date**: 2026-10-31  

---

## 1. Operating System & Client Compatibility

| Client Platform | Tested Version | Configuration Mechanism | Cryptographic Handshake | Operational Status |
| :--- | :--- | :--- | :--- | :--- |
| **Windows 10 / 11** | SEB 3.5.0+ | Direct `.seb` Plist Launch | `X-SafeExamBrowser-RequestHash` | Supported |
| **macOS (Intel & Apple Silicon)** | SEB 3.3.0+ | Direct `.seb` Plist Launch | `X-SafeExamBrowser-RequestHash` | Supported |
| **iOS / iPadOS** | SEB 3.0.0+ | Mobile Safari `.seb` link | `X-SafeExamBrowser-RequestHash` | Supported |
| **Standard Desktop Browsers (Chrome, Edge, Firefox)** | Current Evergreen | Standard HTTPS Web Session | Standard Session Cookie | Supported (Standard Exams Only) |

---

## 2. Examination Security Level Enforcement

| Security Level Setting | Allowed Clients | Required Headers | Missing Header Action | Use Case |
| :--- | :--- | :--- | :--- | :--- |
| `standard` | Any modern browser (Chrome, Edge, Firefox, Safari) | Standard Cortex Auth Session Cookie | Allowed | Homework, quizzes, open-book assessments |
| `seb` / `seb_required` | Safe Exam Browser Only | `X-SafeExamBrowser-RequestHash` or `X-SafeExamBrowser-ConfigKeyHash` | HTTP 403 Forbidden (`sebRequired: true`, includes config & download URLs) | High-stakes university midterms and final examinations |

---

## 3. Recommended University Pilot Configuration

For university production pilots:
1. Provide examinees with the SEB installation package 48 hours prior to examination.
2. Instruct candidates to download the `.seb` examination configuration file directly from the Cortex Exam Lobby.
3. Configure `allowQuit: true` with a secure proctor quit password stored hashed in D1.
4. Ensure campus network firewalls permit outbound HTTPS to the Cloudflare Worker domain.
