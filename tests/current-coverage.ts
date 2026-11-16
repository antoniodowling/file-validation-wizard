import active from "../docs/coverage/active-profiles-2026-11-16.json";
import published from "../docs/coverage/report-schema-4.0.0.json";
// The 17-profile published snapshot is immutable historical evidence.
// Only the 3-profile active snapshot is checked against public registry output.
export default active;
export const demoSnapshots = active.filter(p => p.mode === "DEMO");
export const historicalDemoSnapshots = published.filter(p => p.mode === "DEMO");
export const ordinarySnapshots = published.filter(p => p.profileId === "nacha-origination-public-2026");
export const expandedSnapshots = published.filter(p => p.profileId === "nacha-origination-expanded-public-2026-r1");
export const baiSnapshots = published.filter(p => p.profileId === "huntington-bai2-public-2026-r1");
export const wireSnapshots = published.filter(p => p.profileId === "huntington-csv-wire-public-2026-r1");
