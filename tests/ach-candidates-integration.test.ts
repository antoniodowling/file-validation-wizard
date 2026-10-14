import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import fixtures from "../demo-files/ach-candidates/manifest.json";
import snapshots from "../docs/coverage/ach-candidates-1.0.0.json";
import { ACK_PACK, CONTROL_TOTAL_PACK, ORIGINATION_R2_PACK, RETURNS_PACK } from "../src/format-packs";
import { validateSource } from "../src/validation";
import { validateWorkerRequest } from "../src/worker-request";
import { provenanceFor } from "../src/coverage";
import { validationRunToCsv, validationRunToJson } from "../src/csv";
import { locateFindings } from "../src/finding-locations";
const packs = [ORIGINATION_R2_PACK, RETURNS_PACK, CONTROL_TOTAL_PACK, ACK_PACK];
const source = (name: string) => readFileSync(`demo-files/ach-candidates/${name}`, "utf8");
describe("integrated ACH candidate revisions", () => {
  it.each(fixtures)("validates $name against its declared profile with pinned synthetic bytes", fixture => {
    const text = source(fixture.name);
    expect(Buffer.byteLength(text)).toBe(fixture.bytes);
    expect(createHash("sha256").update(text).digest("hex")).toBe(fixture.sha256);
    const pack = packs.find(pack => pack.id === fixture.profileId)!;
    const run = validateSource(fixture.name, text, pack);
    expect(run.overallStatus).toBe(fixture.expectedStatus);
    expect(run.results.filter(result => result.outcome !== "PASS").map(result => result.ruleId)).toEqual(fixture.expectedFindingIds);
    expect(run.provenance?.schemaVersion).toBe("3");
    if (fixture.expectedStatus === "UNSUPPORTED") { expect(run.verdict).toBeNull(); expect(run.reportedDisposition).toBeUndefined(); }
    else expect(run.verdict).toBe(fixture.expectedStatus);
  });
  it("freezes separate new coverage without changing historical snapshots", () => {
    expect(packs.map(pack => { const { buildRevision, ...snapshot } = provenanceFor(pack); return snapshot; })).toEqual(snapshots);
  });
  it("exports bank-reported rejection independently of a passing validity verdict", () => {
    const run = validateSource("rejected.txt", source("ack-rejected-pass.txt"), ACK_PACK);
    expect(run.verdict).toBe("PASS"); expect(run.errorCount).toBe(0);
    expect(run.reportedDisposition?.file.status).toBe("REJECTED");
    const json = JSON.parse(validationRunToJson(run)); expect(json.exportSchemaVersion).toBe("3");
    expect(json.reportedDisposition.file.status).toBe("REJECTED");
    const csv = validationRunToCsv(run); expect(csv.split("\r\n")[0]).toContain('"Reported File Disposition","Reported File Qualifier","Reported Batch Dispositions"');
    expect(csv).toContain('"REJECTED","ChecksumMismatch"');
  });
  it("neutralizes a reported qualifier formula in schema-3 CSV", () => {
    const csv = validationRunToCsv(validateSource("formula.txt", source("ack-formula-qualifier-pass.txt"), ACK_PACK));
    expect(csv).toContain('"\'=SUM(1)"');
  });
  it.each([ACK_PACK, CONTROL_TOTAL_PACK, RETURNS_PACK])("retains forbidden BOM input for $id in worker decoding", pack => {
    const name = pack === ACK_PACK ? "ack-received-pass.txt" : pack === CONTROL_TOTAL_PACK ? "totals-pass.txt" : "returns-ccd-pass.ach";
    const text = source(name);
    const response = validateWorkerRequest({type:"validate",packId:pack.id,fileName:name,bytes:new TextEncoder().encode("\uFEFF"+text).buffer,includeExplorer:true});
    expect(response.type).toBe("complete");
    if (response.type === "complete") { expect(response.source).toBe("\uFEFF"+text); expect(response.run.overallStatus).toBe("FAIL"); expect(response.run.reportedDisposition).toBeUndefined(); }
  });
  it("keeps authoritative schema-3 finding spans for explorer navigation", () => {
    const text=source("totals-date-fail.txt"); const run=validateSource("bad.txt",text,CONTROL_TOTAL_PACK);
    const finding=locateFindings(text,CONTROL_TOTAL_PACK,run).find(location=>run.results.find(result=>result.ordinal===location.ordinal)?.ruleId==="ach-totals.transmission-date")!;
    expect(finding.location).toMatchObject({kind:"located",primary:{span:{start:50,end:58}}});
  });
  it("suppresses disposition on malformed and unsupported ACK runs", () => {
    for (const name of ["ack-date-fail.txt","ack-status-unsupported.txt"]) {
      const run=validateSource(name,source(name),ACK_PACK); expect(run.reportedDisposition).toBeUndefined();
      expect(validationRunToCsv(run)).not.toContain('"RECEIVED","AcceptedForParsing"');
    }
  });
});
