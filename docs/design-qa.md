# Design QA

Historical review supplied with the project. Referenced captures were temporary local files and are not included; the findings below have not been independently reverified for this handoff.

## Evidence

- Source number treatment: `local-only capture (not included)`
- Source warning treatment: `local-only capture (not included)`
- Source progress-row treatment: `local-only capture (not included)`
- Source refined stepper treatment: `local-only capture (not included)`
- Source compact warning treatment: `local-only capture (not included)`
- Source validation-summary treatment: `local-only capture (not included)`
- Step 1 implementation capture: `local-only capture (not included)`
- Step 2 implementation capture: `local-only capture (not included)`
- Focused number comparison: `local-only capture (not included)`
- Focused warning comparison: `local-only capture (not included)`
- Progress-row implementation capture: `local-only capture (not included)`
- Focused progress-row comparison: `local-only capture (not included)`
- Resized-number and guide-link capture: `local-only capture (not included)`
- Refined Step 1 capture: `local-only capture (not included)`
- Refined Step 2 capture: `local-only capture (not included)`
- Refined Step 3 FAIL capture: `local-only capture (not included)`
- Refined stepper comparison: `local-only capture (not included)`
- Refined warning comparison: `local-only capture (not included)`
- Refined summary comparison: `local-only capture (not included)`
- Browser viewport captured by the Codex in-app browser: 682 by 934 pixels for Step 1 and 667 by 914 pixels for Step 2.
- Source image dimensions: 570 by 164 pixels for the number treatment and 1838 by 164 pixels for the warning treatment.
- Implementation image dimensions: 682 by 934 pixels for Step 1 and 667 by 914 pixels for Step 2.
- Density normalization: component crops were resized to a common comparison width where needed; no device frame or browser chrome was included.
- States: Step 1 initial state and Step 2 with PAIN.001 version `pain.001.001.09` selected.
- Primary interaction tested: searched for PAIN.001, selected the format and
  version, and continued from Step 1 to Step 2.
- Browser console: no errors or warnings; only the expected Vite connection
  debug messages were present.

## Full-view comparison

The revised accordion numbers retain the source's thin teal outline, open interior,
two-digit formatting, sans-serif construction, and left-to-right relationship with
the Huntington Serif heading. Their smaller scale is an intentional adaptation to
the accordion header rather than a page-section hero.

The Step 2 callout retains the source's pale yellow surface, gold left rule, dark
copy, generous horizontal spacing, and outlined triangular warning icon. It has no
corner radius or filled icon background.

The horizontal progress row now keeps each label on one line at the captured
width, uses Huntington Serif for both the numbers and labels, and changes the
third label to “View Results.” Connector lengths compress before labels are
allowed to wrap.

The refined stepper comparison confirms the digits are optically centered after
a one-pixel vertical adjustment. The latest warning comparison confirms the
reduced vertical padding preserves the intended portal callout treatment.

The FAIL-state capture confirms the Validation Summary contains Errors, Warnings,
and Pass boxes, the revised resolution guidance, and balanced three-box spacing.
The results table uses 10%, 18%, 36%, and 36% column proportions for Result,
Field, Path, and Message respectively.

## Focused comparison

- Fonts and typography: the number is outlined in the portal style; accordion
  headings continue to use Huntington Serif and callout text uses ABC Monument
  Grotesque.
- Spacing and layout rhythm: the number and heading share one centered row; the
  callout icon and copy are vertically centered with balanced padding.
- Colors and visual tokens: the established ABC Bank teal, `#fffbeb` warning
  fill, `#cca300` left border, and `#6d590a` icon color are retained.
- Image and icon fidelity: the warning mark comes from the Bootstrap Icons
  `exclamation-triangle` source asset and is an outline icon rather than a custom
  CSS or text-glyph approximation.
- Copy: the new sensitive-data sentence is present verbatim.
- Responsive progress typography: the three labels remain single-line at 375
  CSS pixels and use Huntington Serif; wrapping is reserved for viewports at or
  below 340 CSS pixels.
- Validation results: the FAIL message, plural summary labels, Pass count, and
  revised column proportions are all visible in the rendered browser capture.

## Findings

No actionable P0, P1, or P2 visual differences remain for the two requested
component treatments.

## Comparison history

The first post-implementation comparison found no blocking differences in the
number and warning treatments. A second comparison covered the progress row after
its typography, wrapping behavior, and Step 3 label were revised; no blocking
differences remained after that update. A final visual check confirmed that the
accordion numbers render at half their earlier scale and that the two Step 1 links
remain readable and aligned beneath the version selector. The latest iteration
verified the optically centered stepper digits, reduced callout padding, three-box
Validation Summary, revised FAIL guidance, and expanded Path and Message columns.

## Follow-up polish

None required for this change.

final result: passed
