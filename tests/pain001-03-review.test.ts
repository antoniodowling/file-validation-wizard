import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { provenanceFor } from "../src/coverage";
import { validateSource } from "../src/validation";
import type { IsoVersionIdentifiers } from "../src/types";

// Synthetic baseline independently validated against the complete original .03
// XSD, SHA-256 6bb5c6f24250ab807f31f6164142bafd6d43bad8d162a926e258ff4c11e128af.
// Expected Max35Text boundaries come from that schema, not the application code.
const baseline = readFileSync(`${process.cwd()}/tests/fixtures/pain001-03-schema-valid.xml`, "utf8");
const pack = FORMAT_PACKS.find(p => p.id === "pain-001-03")!;
const run = (source: string) => validateSource("synthetic-pain001-03.xml", source, pack);
const withId = (content: string) => baseline.replace("<MsgId>AUDIT-001</MsgId>", `<MsgId>${content}</MsgId>`);
const withoutDeclaration = baseline.replace(/^<\?xml[^?]*\?>\s*/, "");

describe("PAIN.001.001.03 reviewed identifier limits", () => {
  it.each([
    ["35 ASCII characters", "A".repeat(35), "PASS"],
    ["36 ASCII characters", "A".repeat(36), "ERROR"],
    ["35 supplementary Unicode characters", "𝄞".repeat(35), "PASS"],
    ["36 supplementary Unicode characters", "𝄞".repeat(36), "ERROR"],
    ["35 characters including surrounding spaces", " " + "A".repeat(33) + " ", "PASS"],
    ["36 characters including surrounding spaces", " " + "A".repeat(34) + " ", "ERROR"],
    ["35 decoded character references", "&#65;".repeat(35), "PASS"],
    ["36 decoded character references", "&#65;".repeat(36), "ERROR"],
    ["35 decoded supplementary character references", "&#x1D11E;".repeat(35), "PASS"],
    ["36 decoded supplementary character references", "&#x1D11E;".repeat(36), "ERROR"],
    ["35 CDATA characters", "<![CDATA[" + "A".repeat(35) + "]]>", "PASS"],
    ["36 CDATA characters", "<![CDATA[" + "A".repeat(36) + "]]>", "ERROR"],
  ])("checks %s after XML decoding", (_label, content, expected) => {
    const result = run(withId(content));
    expect(result.results.find(r => r.ruleId === "iso.message-id")?.outcome).toBe(expected);
    expect(result.overallStatus).toBe(expected === "PASS" ? "PASS" : "FAIL");
  });

  it("locates an overlength identifier in the original XML", () => {
    const source = withId("A".repeat(36));
    const finding = run(source).results.find(r => r.ruleId === "iso.message-id")!;
    expect(finding.outcome).toBe("ERROR");
    expect(finding.location?.kind).toBe("located");
    if (finding.location?.kind !== "located") throw new Error("Expected the MsgId element location");
    const { start, end } = finding.location.primary.span;
    expect(source.slice(start, end)).toBe(`<MsgId>${"A".repeat(36)}</MsgId>`);
  });

  // The XSD's text type allows these values; the existing nonblank rule remains
  // a separate documented quality-policy decision, not a new schema assertion.
  it.each([" ", "   ", "\t\n"])("retains the existing nonblank policy for %j", content => {
    expect(run(withId(content)).results.find(r => r.ruleId === "iso.message-id")?.outcome).toBe("ERROR");
  });

  it.each([
    ["empty", "<MsgId/>"],
    ["missing", ""],
    ["nested", "<MsgId><Other>VALUE</Other></MsgId>"],
    ["duplicate", "<MsgId>ONE</MsgId><MsgId>TWO</MsgId>"],
  ])("retains the %s identifier rejection", (_label, replacement) => {
    const source = baseline.replace("<MsgId>AUDIT-001</MsgId>", replacement);
    expect(run(source).results.find(r => r.ruleId === "iso.message-id")?.outcome).toBe("ERROR");
  });
});

describe("PAIN.001.001.03 declaration advice and evidence", () => {
  it("describes an omitted declaration as optional advice", () => {
    const result = run(withoutDeclaration);
    const finding = result.results.find(r => r.ruleId === "demo.xml-declaration")!;
    expect(finding.outcome).toBe("WARNING");
    expect(finding.message).toBe("An XML declaration is recommended but optional; omitting it does not make this XML document invalid.");
    expect(result.errorCount).toBe(0);
    expect(result.overallStatus).toBe("PASS_WITH_WARNINGS");
  });

  it("accepts an actual declaration without an encoding attribute", () => {
    const result = run('<?xml version="1.0"?>\n' + withoutDeclaration);
    expect(result.results.find(r => r.ruleId === "demo.xml-declaration")?.outcome).toBe("PASS");
    expect(result.overallStatus).toBe("PASS");
  });

  it("versions only the reviewed profile and records bounded schema evidence", () => {
    const provenance = provenanceFor(pack);
    expect(provenance.rulesetRevision).toBe("2.3.0");
    expect(provenance.coverageRevision).toBe("pain-001-03@2.3.0/report-4");
    expect(provenance.coverage).toHaveLength(11);
    const schemaRules = ["iso.document-root", "iso.namespace-version", "iso.message-container",
      "iso.group-header", "iso.transaction-count-type", "iso.payment-information"];
    for (const id of schemaRules) {
      expect(provenance.coverage.find(r => r.id === id)?.ruleClass, id).toBe("iso-schema");
    }
    expect(provenance.coverage.find(r => r.id === "iso.safe-declarations")?.ruleClass).toBe("tool-policy");
    expect(provenance.coverage.find(r => r.id === "iso.message-id")?.ruleClass).toBe("demo-structure");
    expect(provenance.coverage.find(r => r.id === "demo.xml-declaration")?.severity).toBe("WARNING");
    expect(provenance.exclusions).toContain("No complete ISO schema validation or Huntington implementation-guide validation.");
  });

  it.each(FORMAT_PACKS.filter(p => p.parserKind === "ISO_XML" && p.id !== "pain-001-03"))(
    "leaves the other profile $id behavior and provenance unchanged", otherPack => {
      const ids = otherPack.identifiers as IsoVersionIdentifiers;
      // This is a legacy-engine regression fixture, not an assertion that a
      // credit-transfer baseline conforms to another ISO message definition.
      const source = withId("A".repeat(36))
        .replaceAll("urn:iso:std:iso:20022:tech:xsd:pain.001.001.03", ids.namespace)
        .replaceAll("CstmrCdtTrfInitn", ids.messageContainer)
        .replace(/^<\?xml[^?]*\?>\s*/, "");
      const result = validateSource("legacy-synthetic.xml", source, otherPack);
      expect(result.results.find(r => r.ruleId === "iso.message-id")?.outcome).toBe("PASS");
      expect(result.results.find(r => r.ruleId === "demo.xml-declaration")?.message)
        .toBe("Add an XML declaration to make the document encoding explicit.");
      expect(provenanceFor(otherPack).rulesetRevision).toBe("2.2.0");
      expect(provenanceFor(otherPack).coverage.find(r => r.id === "iso.document-root")?.ruleClass)
        .toBe("demo-structure");
    });
});
