# CORTEX ONLINE EXAMINATION SYSTEM
# PHASE 4.6 — QUESTION TYPE SUPPORT MATRIX

Date: 2026-10-31  
Assessment Engine Version: 1.0.0  
Status: FULLY VERIFIED  

---

## 1. SUPPORT MATRIX

| Type Identifier | UI Editor Support | Student Runner Support | Auto-Grading Engine | Tolerances / Partials |
|---|---|---|---|---|
| `mcq_single` | Fully Supported | Radio group | Yes | Negative marking supported |
| `mcq_multiple` | Fully Supported | Checkbox group | Yes | Partial credit & negative penalty |
| `true_false` | Fully Supported | Dual-choice pill | Yes | Negative marking supported |
| `numerical` | Fully Supported | Number input | Yes | Floating-point +/- tolerance |
| `short_answer` | Fully Supported | Text area | Configurable (Auto vs Manual) | Case-sensitivity toggle |
| `fill_in_the_blank` | Mapped | Text input | Via `short_answer` string match | Normalization |
| `programming` | Preserved (Non-Exam) | Code Studio / Sandbox | Isolated Docker / Worker runner | Server test cases only |

---

## 2. CONFIGURATION PROTOCOL

### Numerical Question Example
```json
{
  "questionType": "numerical",
  "points": 5.0,
  "negativeMarks": 1.0,
  "numericalTolerance": 0.05,
  "correctAnswer": {
    "value": 3.14159,
    "tolerance": 0.05
  }
}
```

### Multiple-Select Partial Credit Example
```json
{
  "questionType": "mcq_multiple",
  "points": 4.0,
  "correctAnswer": {
    "optionIds": ["opt_a", "opt_c"],
    "partialCredit": true
  }
}
```
Formula applied: `earned = Math.max(0, (correctSelected - wrongSelected) / expectedCount) * points`.
