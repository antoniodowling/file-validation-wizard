# Synthetic CIE / ARC / BOC / POP fixtures

All records are synthetic. Account `000123456789` and routing `021000021` are fixture inputs, not instructions to make a payment. Fixed dates are November 17, 2026.

These files exercise the independent definitions in `src/parsers/nacha-r2-additional-sec.ts`. They are **not admitted by the active R2 pack** until PR #76 supplies registry integration. Passing means the implemented structural checks pass, not complete Nacha or bank acceptance.

| Fixture | Intended condition |
| --- | --- |
| `cie-valid.ach` | CIE swapped name/ID fields and one optional type-05 addenda |
| `cie-invalid.ach` | All-zero 22-column CIE ID |
| `arc-valid.ach` | Ordinary ARC debit with optional name blank |
| `arc-invalid.ach` | All-zero check serial |
| `boc-valid.ach` | Ordinary BOC debit with optional name blank |
| `boc-invalid.ach` | Amount $25,000.01 with correctly recomputed controls |
| `pop-valid.ach` | Separate serial, city and state; optional name blank |
| `pop-invalid.ach` | Blank city only |
| `cie-prenote-valid.ach` | Zero-dollar credit prenote without addenda |
| `pop-prenote-valid.ach` | Zero-dollar debit prenote without addenda |
| `cie-reversal-valid.ach` | Monetary debit with REVERSAL declaration |
| `arc-reversal-valid.ach` | Monetary credit with REVERSAL declaration |
| `mixed-valid.ach` | All four new SECs plus CCD, PPD, CTX, WEB, TEL in separate batches |

The independent builder is `tests/nacha-r2-sec-builder.ts`; it uses its own transaction-direction/zero-amount tables and does not import the implementation under test. The focused suite also mutates field boundaries, amount limits, directions, addenda, service classes and line endings. Source evidence and intentionally unevaluated requirements are in `docs/NACHA_R2_SEC_RULE_REGISTER.md`.
