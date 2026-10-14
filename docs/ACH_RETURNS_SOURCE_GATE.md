# Phase 2 — general ACH Returns source gate

**Current implementation:** Recovered primary evidence now supports an executable ordinary network Returns/COR candidate. The full-pack hold below is superseded; specialized variants and precise qualification exclusions remain individually scoped. See [ACH_RETURNS_CANDIDATE](ACH_RETURNS_CANDIDATE.md). The original assessment below is retained as dated source-review history.

Assessment 2026-10-14. No Returns profile is registered, no placeholder dropdown selection or synthetic conformance kit is published, and no approval/acceptance is claimed. The owner has already selected general network ACH for CCD/PPD/CTX/WEB/TEL, with administrative COR for NOCs. A bank-adapted customer report is not the selected contract. No further product-scope decision is required.

## Established evidence and conflicts

| Source / revision | Supported assessment | Gate |
| --- | --- | --- |
| [Nacha camt.053 mapping guide](https://www.nacha.org/system/files/2023-08/NACHA_ISO20022_Guide_camt.053_returns%2008-09-23.pdf), August 2023 v2.01 | Ordinary 99 and COR 98 layouts; original references and code-specific corrections. Network returns route to the institution receiving the return. | Educational/historical. Pages 49/51 mark addenda trace 80–94 mandatory while describing blanks; page 47 misdescribes CTX count as a trace. Specialized code descriptions do not establish specialized layouts. |
| [GS inbound specification](https://developer.gs.com/docs/services/transaction-banking/ach-inbound/), undated, reviewed 2026-10-14 | Bank report keeps original routing; explicitly links addenda trace to current entry and sets CTX count 0001. | Distinct bank-adapted contract. Its routing policy must not override network ACH or resolve all general-ACH conditions. |
| [Official indexed 2025 appendices](https://nachaoperatingrulesonline.org/assets/attachments/25_basic_appendixes.pdf) | Dishonored, contested and refused-NOC variants differ from ordinary 99/98. Refused NOC uses original change-code/reference fields where ordinary NOC reserves space. | Direct retrieval returns an application shell. Indexed historical evidence is corroboration, not a complete accessible current contract. |
| [Huntington Returns](https://developer.huntington.com/enterprisepayments/docs/nacha-returns) | Useful cross-check for the requested format family. | Conflicting transaction labels and count examples; cannot silently become the general ACH authority. |
| [Treasury transaction dictionary](https://www.fiscal.treasury.gov/data/FMSv48/PIRSRFv10/Library/AttributeDataDictionary.html) | Return/NOC families 21→22/23/24, 26→27/28/29, 31→32/33/34, 36→37/38/39, 51→52/53/54, 56→55. Credit families 21/31/51; debit families 26/36/56. | Family names must not be swapped because a return reverses economic effect. Original matching remains excluded. |

## Currently effective amendments

[October 1, 2024 changes](https://www.nacha.org/rules/risk-management-topics-october-1-2024) expand R06 requests and retain QUESTIONABLE for R17 fraud use. [January 1, 2026 minor changes](https://www.nacha.org/rules/minor-topics-rule-changes) permit R17 questionable determinations before or after posting and define banking days by ACH Operator days. Do not apply historical pre-posting restrictions or proposed/future changes. These facts cannot prove legitimacy or deadlines from one standalone file.

## Exact unresolved contract

- Current network layouts for ordinary, dishonored and contested returns, NOCs and refused NOCs, including status/service class/direction/zero-amount behavior, preserved/modified entry fields, mandatory addenda and CTX count handling.
- Complete active reason/refusal/change vocabularies and applicability. Never accept an invented continuous R/C range. Confirm R69 error-field grammar, R73 date/reference conditions, refusal original-change/reference conditions, and code-specific corrections including C13.
- Authoritative resolutions of the trace/count editorial contradictions. Bank report examples cannot supply missing normative network rules.

## Specification-owner questions (prepared, not sent)

1. Provide the identifier, revision/effective date and authoritative machine-readable source or current rule extracts for the network layouts covering all requested variants. Which current tables resolve the trace/count contradictions identified above?
2. Confirm the complete active reason/change/refusal codes and each conditional field grammar, including R69, R73, C13 and refused-NOC original change/trace references. Confirm the service class, status, transaction-family and amount/control rules per variant.
3. Identify the approved standalone conformance fixtures for independent qualification, with mandatory/optional/suppressed states and expected findings. This is source/fixture evidence, not authorization for original matching or external bank checks.

A separate read-only source reviewer confirmed these gates. No implementation, business fixture approval, Product/SC/FT sign-off or hosted acceptance occurred. No external messages, registration or purchase were performed. Only this pack is held; independent formats may advance. Source-defined implementation can resume after these specific contracts are confirmed.
