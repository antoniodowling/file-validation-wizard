#!/usr/bin/env python3
"""Optional independent XSD oracle. Requires lxml and six original publisher XSDs.

No downloads, application imports, or repository writes. Full schemas are not
redistributed. A missing file/digest mismatch/expectation mismatch fails closed.
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


def verify(directory):
    xs = "http://www.w3.org/2001/XMLSchema"
    report = {"processor": "lxml/libxml2 XMLSchema", "lxml": etree.LXML_VERSION,
              "libxml2": etree.LIBXML_VERSION, "schemas": []}
    failed = False
    for version, (message_id, digest) in SOURCES.items():
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
            types = original.findall(f"{{{xs}}}simpleType[@name='Max15NumericText']")
            if len(types) != 1:
                raise ValueError("Expected exactly one original Max15NumericText definition")
            schema = etree.Element(f"{{{xs}}}schema", nsmap={"xs": xs, "tns": namespace},
                                   targetNamespace=namespace, elementFormDefault="qualified")
            schema.append(copy.deepcopy(types[0]))
            etree.SubElement(schema, f"{{{xs}}}element", name="probe", type="tns:Max15NumericText")
            oracle = etree.XMLSchema(schema)
            entry["cases"] = []
            for value, expected in CASES:
                probe = etree.Element(f"{{{namespace}}}probe")
                probe.text = value
                actual = oracle.validate(probe)
                entry["cases"].append({"text": value, "expected": expected, "accepted": actual})
                failed |= actual != expected
        except (OSError, ValueError, etree.LxmlError) as error:
            entry["error"] = str(error)
            failed = True
        report["schemas"].append(entry)
    print(json.dumps(report, indent=2))
    return int(failed)


if __name__ == "__main__":
    args = argparse.ArgumentParser(description=__doc__)
    args.add_argument("schema_directory", type=Path, help="Directory of exact <message-version>.xsd files")
    raise SystemExit(verify(args.parse_args().schema_directory))
