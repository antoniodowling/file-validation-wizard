import { describe, expect, it } from "vitest";
import { ACK_PROFILE, ACK_RULE_IDS, parseHuntingtonAck } from "../src/parsers/huntington-ack";
import { ackCoverageFor } from "../src/ack-coverage";
import { ResourceLimitError, UnsupportedInputError, MAX_MODEL_NODES, MAX_SCALAR_UNITS, MAX_DECODED_UNITS } from "../src/resource-policy";
import type { FormatPack } from "../src/types";
const pack = { id: ACK_PROFILE, version: "1.0", identifiers: { kind: "HUNTINGTON_ACK", profile: ACK_PROFILE }, rules: [] } as unknown as FormatPack;
const full = `# File-Level Acknowledgment (Header)
HDR|ACK|1.0|FILE_RECEIVED_ACK|2026-03-05T20:14:33Z|UTC

# File Identification
FIL|InboundFileName|Payments_ACH_20260305_1910.dat|CorrelationId|7f3b1c2e-9a6e-4cda-9b43-19a7b2a2e1ef
FIL|OriginalFileSizeBytes|482913|Transport|SFTP|ChecksumAlgo|SHA256|Checksum|c7b8...9f
STA|FILE|RECEIVED|AcceptedForParsing|ParserVersion|2.3.1
MSG|INFO|File received successfully and queued for validation.
BAT|1|BatchRef|BATCH-0001|RecordCount|2500
STA|BATCH|ACCEPTED|BatchValidationPassed
VAL|WARNING|LINE|134|Field: PaymentDate|Adjusted to business day
VAL|ERROR  |LINE|248|Field: Amount|Non-numeric value "12A.00"
CTL|DeclaredRecordCount|2500|ReceivedRecordCount|2500|DeclaredHash|12345678|ReceivedHash|12345678
TRL|END|2026-03-05T20:14:34Z`;
const minimal = full.split("\n").filter(line => !/^(#|MSG|BAT|VAL|STA\|BATCH)/.test(line)).join("\n");
const parse = (source = full) => parseHuntingtonAck(source, pack);
const bad = (source: string, id?: string) => { const out = parse(source); expect(out.results.some(r => r.outcome === "ERROR" && (!id || r.ruleId === `ack.${id}`))).toBe(true); expect(out.reportedDisposition).toBeUndefined(); expect(out.context).toBeNull(); };
describe("Huntington uncustomized ACK pipe candidate", () => {
  it("admits the full public sample including padded VAL ERROR and abbreviated checksum", () => { const out = parse(); expect(out.results.every(r => r.outcome === "PASS")).toBe(true); expect(out.reportedDisposition).toEqual({ file: { status: "RECEIVED", qualifier: "AcceptedForParsing" }, batches: [{ batchNumber: "1", batchReference: "BATCH-0001", status: "ACCEPTED", qualifier: "BatchValidationPassed" }] }); });
  it("admits file-only and CRLF/comment framing with original offsets", () => { const out = parse(minimal.replaceAll("\n", "\r\n") + "\r\n# end\r\n"); expect(out.reportedDisposition?.batches).toEqual([]); expect(out.notApplicable).toContain("ack.batch"); const loc = out.results.find(r => r.ruleId === "ack.header")?.location; expect(loc?.kind).toBe("located"); if (loc?.kind === "located") expect(loc.primary.span.start).toBe(minimal.replaceAll("\n", "\r\n").indexOf("HDR")); });
  it("does not confuse bank rejection/errors or mismatched original controls with syntax failure", () => { const out = parse(full.replace("STA|FILE|RECEIVED", "STA|FILE|REJECTED").replace("ReceivedRecordCount|2500", "ReceivedRecordCount|2499").replace("ReceivedHash|12345678", "ReceivedHash|0")); expect(out.results.every(r => r.outcome === "PASS")).toBe(true); expect(out.reportedDisposition?.file.status).toBe("REJECTED"); });
  it.each(["RECEIVED", "ACCEPTED", "REJECTED"])("admits status %s", status => expect(parse(minimal.replace("STA|FILE|RECEIVED", `STA|FILE|${status}`)).reportedDisposition?.file.status).toBe(status));
  it.each([
    ["unknown version", full.replace("HDR|ACK|1.0", "HDR|ACK|2.0")],
    ["unknown tag", full + "\nNEW|field"],
    ["unknown status", full.replace("STA|FILE|RECEIVED", "STA|FILE|PENDING")],
    ["comma delimiter", full.replaceAll("|", ",")],
    ["tab delimiter", full.replaceAll("|", "\t")],
    ["unknown FIL key", full.replace("InboundFileName", "__proto__")],
  ])("issues no verdict for %s", (_name, source) => expect(() => parse(source)).toThrow(UnsupportedInputError));
  it("issues no verdict for a different selected profile", () => expect(() => parseHuntingtonAck(full, { ...pack, id: "other" })).toThrow(UnsupportedInputError));
  it.each([
    ["header", full.replace("|UTC", "|GMT")],
    ["framing", "\ufeff" + full],
    ["framing", full.replaceAll("\n", "\r")],
    ["framing", full.replace("c7b8...9f", "bad\u0000text")],
    ["file-identification", full.replace("|482913|", "|-1|")],
    ["file-identification", full.replace("FIL|OriginalFileSizeBytes", "FIL|CorrelationId")],
    ["file-identification", full.replace("|CorrelationId|7f3b1c2e-9a6e-4cda-9b43-19a7b2a2e1ef", "")],
    ["status", full.replace("|AcceptedForParsing|", "||")],
    ["message", full.replace("MSG|INFO", "MSG|NOTICE")],
    ["batch", full.replace("BAT|1|", "BAT|0|")],
    ["validation-report", full.replace("|LINE|248|", "|LINE|-1|")],
    ["validation-report", full.replace("|Field: Amount|", "|Amount|")],
    ["control", full.replace("ReceivedHash|12345678", "ReceivedHash|abc")],
    ["control", full.replace("ReceivedHash|12345678", "DeclaredHash|12345678")],
    ["trailer", full.replace("TRL|END|", "TRL|DONE|")],
    ["timestamp-order", full.replace("20:14:34Z", "20:14:32Z")],
    ["record-order", full + "\nMSG|INFO|extra"],
    ["record-order", full.replace("STA|BATCH|ACCEPTED|BatchValidationPassed\n", "")],
    ["record-order", full.replace("CTL|DeclaredRecordCount|2500|ReceivedRecordCount|2500|DeclaredHash|12345678|ReceivedHash|12345678\n", "")],
  ])("fails malformed %s syntax", (id, source) => bad(source, id));
  it.each(["2026-02-30T20:14:33Z", "2026-13-05T20:14:33Z", "2026-03-05T24:00:00Z", "2026-03-05T20:14:60Z", "2026-03-05T20:14:33+00:00"])("rejects invalid timestamp %s", value => bad(minimal.replace("2026-03-05T20:14:33Z", value), "header"));
  it("admits real leap day and fractional UTC timestamps", () => expect(parse(minimal.replace("2026-03-05T20:14:33Z", "2024-02-29T20:14:33.123Z").replace("2026-03-05T20:14:34Z", "2024-02-29T20:14:33.124Z")).reportedDisposition).toBeDefined());
  it("aggregates repeated findings and retains first original source span", () => { const line = "VAL|ERROR|LINE|0|Field: Amount|bad"; const source = full.replace("VAL|WARNING|LINE|134|Field: PaymentDate|Adjusted to business day", [line, line, line].join("\r\n")); const out = parse(source); const findings = out.results.filter(r => r.ruleId === "ack.validation-report"); expect(findings).toHaveLength(1); expect(findings[0]?.message).toContain("3 violations"); const loc = findings[0]?.location; if (loc?.kind !== "located") throw new Error("Missing span"); expect(source.slice(loc.primary.span.start, loc.primary.span.end)).toBe(line); });
  it("fails duplicate batches, missing/duplicate file dispositions, and reordered records", () => { bad(full.replace("VAL|WARNING", "BAT|1|BatchRef|OTHER|RecordCount|0\nSTA|BATCH|REJECTED|reason\nVAL|WARNING"), "batch"); bad(full.replace("STA|FILE|RECEIVED|AcceptedForParsing|ParserVersion|2.3.1\n", ""), "record-order"); bad(full.replace("MSG|INFO", "STA|FILE|ACCEPTED|reason\nMSG|INFO"), "record-order"); bad(full.replace("MSG|INFO|File received successfully and queued for validation.\n", "").replace("VAL|WARNING", "MSG|INFO|late message\nVAL|WARNING"), "record-order"); });
  it("bounds decoded input, rows, scalar and field fanout", () => { for (const source of [" ".repeat(MAX_DECODED_UNITS + 1), "\n".repeat(MAX_MODEL_NODES + 1), "#" + "a".repeat(MAX_SCALAR_UNITS), "FIL|" + "x|".repeat(33), "STA|FILE|RECEIVED|reason\n".repeat(Math.ceil(MAX_MODEL_NODES / 5) + 1)]) expect(() => parse(source)).toThrow(ResourceLimitError); });
  it("coverage lists precisely implemented fixed checks", () => expect(ackCoverageFor(pack).map(r => r.id)).toEqual(ACK_RULE_IDS));
});
