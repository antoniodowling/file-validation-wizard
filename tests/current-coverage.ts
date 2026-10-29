import snapshot from "../docs/coverage/report-schema-4.0.0.json";
export default snapshot;
export const demoSnapshots = snapshot.filter(p => p.mode === "DEMO");
export const ordinarySnapshots = snapshot.filter(p => p.profileId === "nacha-origination-public-2026");
export const expandedSnapshots = snapshot.filter(p => p.profileId === "nacha-origination-expanded-public-2026-r1");
export const baiSnapshots = snapshot.filter(p => p.profileId === "huntington-bai2-public-2026-r1");
export const wireSnapshots = snapshot.filter(p => p.profileId === "huntington-csv-wire-public-2026-r1");
