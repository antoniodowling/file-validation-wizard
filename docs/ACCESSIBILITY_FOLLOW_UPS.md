# WCAG 2.2 AA Follow-up Log

The Payment File Validation Wizard targets WCAG 2.2 Level AA. This log separates
confirmed issues from checks that still require manual evidence. An automated scan
or a single browser state is not sufficient to claim conformance for the complete
three-step workflow.

Audit date: 2026-09-17

## Open issues

| ID | Priority | WCAG criterion | Finding | Required resolution | Acceptance evidence |
| --- | --- | --- | --- | --- | --- |
| A11Y-001 | Release blocker | 1.4.3 Contrast (Minimum); 1.4.11 Non-text Contrast | Warning chip text uses `#cca300` on `#fffbeb`, which is approximately 2.30:1. This is below the 4.5:1 requirement for its small text. The selected Warning filter border is approximately 2.19:1 against its surrounding panel, below the 3:1 requirement for a visible state indicator. | Keep the requested pale warning fill, but use text and selected-state treatments that meet their respective contrast requirements. Treat decorative border and icon colors independently from readable text and essential state indicators. | Automated contrast assertions plus visual verification of the Warning filter and every Warning result chip. |
| A11Y-003 | High | 1.4.10 Reflow | At a narrow/zoom-like browser width, the three-column format results clipped the Standard column and introduced horizontal scrolling inside the listbox. | Reflow each result into a compact stacked layout, or otherwise keep all three values readable without horizontal scrolling at 320 CSS pixels and 200% zoom. | Browser evidence at 320 CSS pixels and desktop 200% zoom with representative short and long entries. |

## Verification still required

| ID | Priority | Area | Verification required |
| --- | --- | --- | --- |
| A11Y-006 | High | Automated coverage | Run automated accessibility scans in Step 1, Step 2, and Step 3 for PASS, PASS WITH WARNINGS, FAIL, and parsing-failure states. The existing automated scan covers only the initial Step 1 state. |
| A11Y-007 | High | Zoom and responsive behavior | Verify the complete workflow at 200% browser zoom and at 320 CSS pixels. Include the open format list, long and Unicode filenames, validation controls, result filters, and the horizontally scrollable data table. |
| A11Y-008 | High | Screen readers and announcements | Verify the combobox, current-step status, upload errors, validation-start/completion announcements, filter pressed states, result counts, and table navigation with VoiceOver/Safari and at least one Windows screen-reader/browser combination. |
| A11Y-009 | Medium | Results table overflow | Confirm that the intentionally wide result table remains keyboard operable and understandable when it scrolls in two dimensions at narrow widths. If its scroll region is difficult to discover, focus, or identify, add a labeled focusable scroll container and concise instructions. |
| A11Y-010 | High | ReadMe page integration | Confirm that the surrounding ReadMe Custom Page supplies one descriptive level-one heading above the validator. The embedded module intentionally omits a duplicate `h1` because its page introduction is owned by ReadMe. |
| A11Y-011 | High | File explorer workspace | Verify the splitter, finding actions, source focus/return controls, search, go-to-line, related locations, hide/expand, and Results/File views with keyboard-only operation. Confirm focus remains predictable after filtering, pagination, and returning to a finding. |
| A11Y-012 | High | File explorer reflow | Verify the complete explorer workflow at 320 CSS pixels and 200% zoom, including long filenames/paths, excerpt notices, source horizontal scrolling, and no page-level clipping. |
| A11Y-013 | High | File explorer assistive technology | Verify location-quality announcements, selected-finding state, the read-only virtualized source, original line numbers, and forced-color highlights with VoiceOver/Safari and a Windows screen-reader/browser combination. |

## Resolved items

| ID | Resolved | Resolution | Remaining verification |
| --- | --- | --- | --- |
| A11Y-002 | 2026-09-17 | Removed the yellow keyboard-focus outline. Focused controls now use an internal high-contrast teal treatment, with a pale internal treatment on teal primary controls. | Complete the all-control keyboard traversal recorded in A11Y-008. |
| A11Y-004 | 2026-09-18 | The active visual step now receives `aria-current="step"`, and inactive steps have it removed during every render. | Complete the accessibility-tree and screen-reader checks already recorded in A11Y-008. |
| A11Y-005 | 2026-09-18 | All four validation-result headers now declare `scope="col"`. | Complete the screen-reader table-navigation check already recorded in A11Y-008 and A11Y-009. |

## Checks that currently look healthy

- Body text (`#253f42` on `#f5fcfd`) is approximately 10.83:1, and helper
  text (`#52696c`) is approximately 5.62:1 on the page background.
- Pass chip text is approximately 6.13:1, and Error chip text is approximately
  5.85:1, against their respective fills.
- Primary button text is approximately 8.99:1 against the teal control.
- Main controls provide 42-48 CSS-pixel heights, exceeding the WCAG 2.2 AA
  24-by-24 CSS-pixel minimum target size in the audited layouts.
- Accordion triggers are buttons with `aria-expanded` and `aria-controls`;
  result-filter buttons expose `aria-pressed`; form controls have programmatic
  labels; upload errors use `role="alert"`; and validation status uses a polite
  live region.
- Error, Warning, and Pass states include text labels in addition to color.
- Reduced-motion styles remove smooth scrolling and transitions.
- Step-transition focus is directed to an expanded panel that is made
  programmatically focusable before focus is moved.

## Evidence boundary

This review used source inspection, existing unit/browser tests, computed color
contrast, and current-run visual inspection of Steps 1 and 2. The browser did
not permit the local fixture upload used to open Step 3 during this review, so
the Step 3 visual check remains part of A11Y-006 through A11Y-009. No manual
screen-reader session or actual 200% browser-zoom pass has been completed.
