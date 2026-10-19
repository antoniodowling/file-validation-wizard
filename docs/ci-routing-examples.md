# Examples of CI routing

The workflow and trusted classifier determine the route. These examples explain
what contributors can expect from the current documentation policy.

| Change | Expected route |
| --- | --- |
| Owner edits ordinary README or planning prose | Lightweight classification and an explicit documentation-only result |
| Draft code or draft prose | Substantive jobs skip before runner allocation; no automatic merge |
| Source, executable content, enforcement instructions, or mixed code and prose | Existing core, package-drift and browser validation |
| Code has an older successful run and a newer incomplete or failed run | Latest matching required proof controls |
| A PR has a deliberate hold or blocking objection | Automatic documentation merging remains withheld |

A documentation-only result means application tests were not required for the
classified change. It does not claim those tests ran. Source changes continue
through the existing validator and browser suites. Public forks do not receive
the owner's documentation exemption or privileged policy credentials.
