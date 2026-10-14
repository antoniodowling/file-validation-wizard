# NACHA authoritative-source review

Research date: 2026-10-14. NACHA validation has not been implemented or approved.

## Agreed implementation scope

One main NACHA / ACH selection, supporting any subset or mix of CCD, PPD, CTX, WEB, and TEL batches for ordinary debit/credit originations. The intended checks cover record structure, required fields and codes, routing check digits, addenda relationships, trace sequencing, counts, hashes, and amount totals. Balanced and unbalanced files and newline-separated or concatenated records are intended inputs. Returns, notifications of change, prenotes, and reversals are outside the initial scope. These intentions do not establish current support.

The catalog retains the existing PAIN.001, PAIN.008, and EDI 820 validators and versions. Their limited validation and demo approval status are unchanged. Other reference-only catalog placeholders were removed; NACHA is the sole pending selection, with no executable profile. Its 2026 label is an intended rules baseline, not a detected file version or a support claim.

## Authoritative publisher and available access

The authoritative source is Nacha's **2026 Nacha Operating Rules & Guidelines**, including applicable supplements and effective dates. The public developer guide points to Appendix Three for the full record-format specifications; the guide alone does not establish complete production coverage.

- [Official rules resource](https://nachaoperatingrulesonline.org/).
- [Official access/support description](https://nachaoperatingrulesonline.org/support): Basic Access is a read-only PDF and excludes the Guidelines and enhanced features. This description was available through the search index; live pages returned a JavaScript application shell to the research tool.
- [Official full-access content listing](https://nachaoperatingrulesonline.org/pubchange): the indexed listing identifies the 2026 Rules, Guidelines, and Supplements #1, #2, and #3. Current authenticated content and the applicability of individual amendments still need verification.
- [Nacha's 2026 user instructions](https://www.nacha.org/system/files/2025-12/2026_NORO_User_Instructions.pdf) describe individual-account subscription access. Do not share accounts or copy the licensed rulebook into this repository.

## Free Basic Access route

[Dieterich Bank's explicitly dated 2026 Basic Access instructions](https://www.dieterichbank.com/wp-content/uploads/2026/01/Obtain-Nacha-Operating-Rules-Online-Resource-2026.pdf) document a route requiring no subscription code:

1. Visit the official rules resource and log in or create an individual account.
2. Choose the option indicating no Full Access subscription code, provide the required information, and review the terms.
3. Open Resources and view the Introductory Pages, Articles, and Appendices PDFs.

This bank document explains access; it is not the specification. The authenticated 2026 Appendix Three was not inspected. Availability of all current supplements through Basic Access was not established. An indexed public Basic appendices PDF identifies itself as **2025** and must not be treated as the 2026 source. No account was created and no terms were accepted during this research.

## Full Access alternative

[The Clearing House's 2026 Online Access listing](https://www.theclearinghouse.org/payments-services/Store/detail/2026-ACH-Rules-Online-Acces) lists $85 nonmember / $50 member and describes access to the full Rules, Guidelines, and supplement details through December 31, 2026. [Nacha's store](https://www.nacha.org/store) lists the online resource at $110 nonmember / $75 member. These are observed listings, not a purchase or a guaranteed checkout price. No purchase was made.

## Source verification before NACHA implementation

The owner needs to establish usable access to the official 2026 source. Verify the edition, Appendix Three coverage for all five SEC codes, applicable data specifications, and amendments effective at the chosen release date. Basic Access may suffice if those requirements are available; otherwise use Full Access or an appropriately licensed organizational copy. Preserve section references and review dates in the eventual rule-to-fixture matrix rather than reproducing the copyrighted specification.

Only after that verification should the parser and rule implementation begin. Production release remains subject to approved rules/fixtures, Product/SC/FT sign-offs, browser and ReadMe acceptance, and the existing release gates. The present catalog cleanup does not supply any of those approvals.
