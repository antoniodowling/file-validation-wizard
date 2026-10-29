import { describe, expect, it } from "vitest";
import { FORMAT_PACKS } from "../src/format-packs";
import { validateSource } from "../src/validation";
import type { FormatPack, IsoVersionIdentifiers } from "../src/types";

const packs = FORMAT_PACKS.filter(pack => pack.parserKind === "ISO_XML");
function document(pack: FormatPack, count: string, prolog = '<?xml version="1.0" encoding="UTF-8"?>'): string {
  const ids = pack.identifiers as IsoVersionIdentifiers;
  return `${prolog}<Document xmlns="${ids.namespace}"><${ids.messageContainer}><GrpHdr><MsgId>SYNTHETIC</MsgId>${count}</GrpHdr><PmtInf/></${ids.messageContainer}></Document>`;
}
const outcome = (pack: FormatPack, source: string, id = "iso.transaction-count-type") =>
  validateSource("synthetic.xml", source, pack).results.find(result => result.ruleId === id)?.outcome;

// These expected lexical boundaries are the issue #53 source-review contract.
// Fresh original-schema oracle verification is tracked separately in ISO_RULE_CORRECTIONS.md.
describe.each(packs)("ISO scalar and declaration checks: $id", pack => {
  it.each(["1", "0001", "123456789012345", "&#49;", "<![CDATA[1]]>"])("admits decoded numeric text %s", text => {
    expect(outcome(pack, document(pack, `<NbOfTxs>${text}</NbOfTxs>`))).toBe("PASS");
  });
  it.each(["", "1234567890123456", " 1", "1 ", "\t1", "1\n", "\r\n1\r\n", "&#32;1", "1&#x9;", "<![CDATA[ 1 ]]>", "one", "<Count>1</Count>"])("rejects non-numeric/scalar text %s", text => {
    expect(outcome(pack, document(pack, `<NbOfTxs>${text}</NbOfTxs>`))).toBe("ERROR");
  });
  it.each(['<NbOfTxs>1</NbOfTxs><NbOfTxs>1</NbOfTxs>', '<NbOfTxs xmlns="urn:other">1</NbOfTxs>', ""])("retains exact cardinality and namespace %s", count => {
    expect(outcome(pack, document(pack, count))).toBe("ERROR");
  });
  it.each(["", '<?xml-stylesheet href="synthetic.xsl" type="text/xsl"?>', '<?xml-model href="synthetic.rng"?>', '<!-- <?xml version="1.0"?> -->', '<?example value="<?xml"?>'])("does not confuse declaration with inert text: %s", prolog => {
    const run = validateSource("synthetic.xml", document(pack, "<NbOfTxs>1</NbOfTxs>", prolog), pack);
    expect(run.results.find(result => result.ruleId === "demo.xml-declaration")?.outcome).toBe("WARNING");
    expect(run.overallStatus).toBe("PASS_WITH_WARNINGS");
  });
  it("retains a real declaration followed by processing instructions", () => {
    expect(outcome(pack, document(pack, "<NbOfTxs>1</NbOfTxs>", '<?xml version="1.0"?><?xml-stylesheet href="synthetic.xsl"?>'), "demo.xml-declaration")).toBe("PASS");
  });
  it.each(['<?xml version="1.1"?>', '<?xml version="1.0" encoding="UTF-16"?>'])("preserves unsupported declaration admission: %s", prolog => {
    const run = validateSource("synthetic.xml", document(pack, "<NbOfTxs>1</NbOfTxs>", prolog), pack);
    expect(run.executionStatus).toBe("UNSUPPORTED"); expect(run.verdict).toBeNull();
  });
  it("rejects a malformed declaration without evaluating the advisory", () => {
    const run = validateSource("synthetic.xml", document(pack, "<NbOfTxs>1</NbOfTxs>", '<?xml version=1.0?>'), pack);
    expect(run.overallStatus).toBe("FAIL");
    expect(run.results.some(result => result.ruleId === "demo.xml-declaration")).toBe(false);
  });
});
