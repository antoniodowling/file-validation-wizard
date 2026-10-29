import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { expect, it } from "vitest";
const historical = {
  "docs/coverage/bai2-candidate-1.1.0.json": "373f124b1aee9d58eed3c66a407a843f3db0bcc114905f3abb4830da6321d6ea",
  "docs/coverage/edi-ruleset-2.1.0.json": "a5e23619214805cea0648854962c3ebf3a2e2bce1edf2450a6de8936968fe78b",
  "docs/coverage/ach-candidates-1.0.0.json": "62a5b924f1c7f4e68cc14bd19fff80d3dad7ef54d2d2233dd916d8f275ca1c4f",
  "docs/coverage/bai2-candidate-1.0.0.json": "84b48dff16a035bfb9be35b28c1be4a05ba53ca6bb65c0c10e1daa69ce4d33e2",
  "docs/coverage/csv-wire-candidate-1.0.0.json": "0e49fc7c1841f302ffa0ce02037cca2f3b089e8eda4b9ccb8fcbfb1fe3115a2a",
  "docs/coverage/nacha-expanded-public-1.0.0.json": "4f9a1c130d94779bc771f2a74ba78bffd658538c83680bbbecc0965afd98ba28",
  "docs/coverage/nacha-expanded-public-1.1.0.json": "2f5d7a384981a787c9735cadc615829b9743e74b87e8ac764c26cbd58902e86f",
  "docs/coverage/nacha-origination-r2-1.1.0.json": "c0e141ff0ad49124e1d60cace0090216c390e46aba18052e4caf7cfadfe2564c",
  "docs/coverage/nacha-public-1.0.0.json": "24e9200bca5bd7cb962a6d0529aae2917a41b7462da281bc67da32dc1a342225",
  "docs/coverage/nacha-public-1.1.0.json": "cc9039173e648ab2faa7de87c5248d4034debec635f708ce747bec32fb5b2853",
  "docs/coverage/ruleset-2.0.0.json": "7f6c77e174d628270b84a3db2fbf73ef7e03f51c1f96454aa57c7f3f6c3facb1",
  "docs/coverage/ruleset-2.1.0.json": "c7ae0b2098a919075afcb54e2c99c13d63e5c3569ee18639386237be5f40f177"
};
it("preserves every pre-schema-4 coverage snapshot byte-for-byte", () => {
 for (const [path, hash] of Object.entries(historical)) expect(createHash("sha256").update(readFileSync(path)).digest("hex"), path).toBe(hash);
});
