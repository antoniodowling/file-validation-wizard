import historicalSnapshot from "../docs/coverage/report-schema-4.0.0.json";
import pain00103Snapshot from "../docs/coverage/pain001-03-ruleset-2.4.0.json";
const snapshot = historicalSnapshot.map(profile => pain00103Snapshot.find(current => current.profileId === profile.profileId) ?? profile);
export default snapshot;
export const demoSnapshots = snapshot.filter(p => p.mode === "DEMO");
export const ordinarySnapshots = snapshot.filter(p => p.profileId === "nacha-origination-public-2026");
export const expandedSnapshots = snapshot.filter(p => p.profileId === "nacha-origination-expanded-public-2026-r1");
export const baiSnapshots = snapshot.filter(p => p.profileId === "huntington-bai2-public-2026-r1");
export const wireSnapshots = snapshot.filter(p => p.profileId === "huntington-csv-wire-public-2026-r1");
