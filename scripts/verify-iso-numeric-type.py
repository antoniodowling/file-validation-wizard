#!/usr/bin/env python3
"""Optional independent XSD oracle. Requires lxml and original publisher XSDs.

No downloads, application imports, or repository writes. Full schemas are not
redistributed. A missing file/digest mismatch/expectation mismatch fails closed.
By default all six original numeric types are required. Use --version to select
an explicit subset; --include-message-id adds the .03 Max35Text boundary check.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from lxml import etree

SOURCES = {
    "pain.001.001.03": (14316, "6bb5c6f24250ab807f31f6164142bafd6d43bad8d162a926e258ff4c11e128af"),
    "pain.001.001.09": (14346, "de038b373e47b0077b1832ddd81f4b2f1eb25d35721f62da1e38b7f5a09fda24"),
    "pain.001.001.13": (23503, "f6ab7c1763c0cf4e6f0fc61eb99e988fe1c243cc56a683ded9d25f71f6b305d9"),
    "pain.008.001.02": (14451, "7900f72a3a0d872a99e5be1c7a94586c59e412bf9781ea4c4e78959f84191cd6"),
    "pain.008.001.08": (14481, "7edf4e4ce34c47a5567af6a327e22af4ed4007f715822af9f353c94ecc10f5ba"),
    "pain.008.001.12": (23506, "99f7584b2fa29820fa3e6e99379c9823ef7e4a713f6c59cb86c9b086032a782f"),
}
CASES = [("1", True), ("0001", True), ("123456789012345", True),
         ("1234567890123456", False), ("", False), ("one", False),
         (" 1", False), ("1 ", False), ("\t1", False), ("1\n", False),
         ("\r\n1\r\n", False)]
MESSAGE_ID_CASES = [("", False), ("A", True), ("A" * 35, True),
                    ("A" * 36, False), (" ", True), ("\t\n", True),
                    ("A" * 34 + " ", True), ("A" * 35 + " ", False),
                    ("\U0001d11e" * 35, True), ("\U0001d11e" * 36, False)]


def probe_original_type(original, namespace, type_name, cases):
    xs = "http://www.w3.org/2001/XMLSchema"
    definitions = original.findall(f"{{{xs}}}simpleType[@name='{type_name}']")
    if len(definitions) != 1:
        raise ValueError(f"Expected exactly one original {type_name} definition")
    schema = etree.Element(f"{{{xs}}}schema", nsmap={"xs": xs, "tns": namespace},
                           targetNamespace=namespace, elementFormDefault="qualified")
    schema.append(copy.deepcopy(definitions[0]))
    etree.SubElement(schema, f"{{{xs}}}element", name="probe", type=f"tns:{type_name}")
    oracle = etree.XMLSchema(schema)
    results = []
    for value, expected in cases:
        probe = etree.Element(f"{{{namespace}}}probe")
        probe.text = value
        results.append({"text": value, "expected": expected, "accepted": oracle.validate(probe)})
    return results


def verify(directory, versions=None, include_message_id=False):
    selected = list(SOURCES) if versions is None else list(dict.fromkeys(versions))
    report = {"processor": "lxml/libxml2 XMLSchema", "lxml": etree.LXML_VERSION,
              "libxml2": etree.LIBXML_VERSION, "selected_versions": selected, "schemas": []}
    failed = False
    for version in selected:
        message_id, digest = SOURCES[version]
        entry = {"version": version, "url": f"https://www.iso20022.org/message/{message_id}/download"}
        try:
            data = (directory / f"{version}.xsd").read_bytes()
            actual = hashlib.sha256(data).hexdigest()
            entry["sha256"] = actual
            if actual != digest:
                raise ValueError("Original-schema digest differs from the review; investigate before updating provenance")
            parser = etree.XMLParser(resolve_entities=False, no_network=True)
            original = etree.fromstring(data, parser)
            namespace = original.get("targetNamespace")
            if namespace != f"urn:iso:std:iso:20022:tech:xsd:{version}":
                raise ValueError("Unexpected target namespace")
            entry["cases"] = probe_original_type(original, namespace, "Max15NumericText", CASES)
            failed |= any(case["accepted"] != case["expected"] for case in entry["cases"])
            if include_message_id:
                entry["message_id_cases"] = probe_original_type(original, namespace, "Max35Text", MESSAGE_ID_CASES)
                failed |= any(case["accepted"] != case["expected"] for case in entry["message_id_cases"])
        except (OSError, ValueError, etree.LxmlError) as error:
            entry["error"] = str(error)
            failed = True
        report["schemas"].append(entry)
    print(json.dumps(report, indent=2))
    return int(failed)


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("schema_directory", type=Path, help="Directory of exact <message-version>.xsd files")
    args.add_argument("--version", action="append", choices=SOURCES,
                      help="Verify only this exact version; repeat to select several. Default: all six.")
    args.add_argument("--include-message-id", action="store_true",
                      help="Also probe original Max35Text; requires only --version pain.001.001.03.")
    parsed = args.parse_args()
    if parsed.include_message_id and set(parsed.version or []) != {"pain.001.001.03"}:
        args.error("--include-message-id requires only --version pain.001.001.03")
    raise SystemExit(verify(parsed.schema_directory, parsed.version, parsed.include_message_id))
