# Expanded NACHA synthetic kit

Profile `nacha-origination-expanded-public-2026-r1`; ruleset `nacha-expanded-public-1.0.0`. Deterministic generation: `node scripts/generate-nacha-expanded-files.mjs`. Manifest pins SHA-256, byte sizes, expected verdicts and expected finding IDs. Synthetic values only; routing checksums do not prove directory membership.

Includes all five SECs, monetary/prenote/remittance transaction codes, mixed balanced/unbalanced controls, TEL credit and loan debit reversals, malformed framing/encoding/fields, optional/no-addenda states, prerequisites, within-file traces, control/hash wrap, exact cents, all implemented warning/error branches, X12 BPR/BPS and non-820 framing. Unsupported UN/EDIFACT and WEB loans carry no verdict. Historical `../nacha` fixtures are preserved separately and are not new conformance evidence.

See [source-to-rule matrix and qualification gates](../../docs/ACH_ORIGINATION_EXPANDED.md). Independent tests verify known source field positions and manual count/hash expectations separately from generator arithmetic. Candidate fixtures are not approved bank files.
