export const MAX_FILE_BYTES = 25_000_000;
export const VALIDATION_DEADLINE_MS = 10_000;

export type WorkerFailureCode = "FILE_TOO_LARGE" | "PROFILE_UNAVAILABLE" | "INVALID_ENCODING" | "ENGINE_ERROR" | "RESOURCE_LIMIT";
export type ValidationFailureCode = WorkerFailureCode | "FILE_READ_ERROR" | "WORKER_UNAVAILABLE" | "WORKER_ERROR" | "TIMEOUT";

export type FormatFamily = "PAIN.001" | "PAIN.008" | "EDI 820" | "NACHA";
export type ParserKind = "ISO_XML" | "EDI_X12" | "NACHA_FIXED";
export type FormatPackMode = "DEMO" | "CANDIDATE" | "PRODUCTION";
export type CatalogStatus = "DEMO_SUPPORTED" | "CANDIDATE_SUPPORTED" | "REFERENCE_ONLY";
export type RuleOutcome = "PASS" | "ERROR" | "WARNING";
export type FindingSeverity = "ERROR" | "WARNING";
export type OverallStatus = "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | "UNSUPPORTED" | "INCOMPLETE";

export interface SourceSpan {
  readonly start: number;
  readonly end: number;
}

export type SourceTargetKind = "exact" | "context" | "parser-position";

export interface SourceTarget {
  readonly span: SourceSpan;
  readonly kind: SourceTargetKind;
  readonly label: string;
}

export type FindingLocation =
  | {
      readonly kind: "located";
      readonly primary: SourceTarget;
      readonly related: readonly SourceTarget[];
      readonly relatedTruncated?: boolean;
    }
  | { readonly kind: "file-wide"; readonly explanation: string }
  | { readonly kind: "unavailable"; readonly explanation: string };

export interface FindingLineEntry {
  readonly context?: boolean;
  readonly ordinal: number;
  readonly label: string;
  readonly description: string;
}

export interface FindingLocationEntry {
  readonly ordinal: number;
  readonly location: FindingLocation;
}

export interface IsoVersionIdentifiers {
  readonly kind: "ISO_XML";
  readonly namespace: string;
  readonly messageContainer: "CstmrCdtTrfInitn" | "CstmrDrctDbtInitn";
}

export interface EdiVersionIdentifiers {
  readonly kind: "EDI_X12";
  readonly isa12: string;
  readonly gs08: string;
  readonly st03?: string;
}

export interface NachaVersionIdentifiers {
  readonly kind: "NACHA_FIXED";
  readonly profile: "origination-public-2026" | "origination-expanded-public-2026-r1";
  readonly secCodes: readonly string[];
}

export type VersionIdentifiers = IsoVersionIdentifiers | EdiVersionIdentifiers | NachaVersionIdentifiers;

export interface RuleEvaluation {
  readonly outcome: RuleOutcome;
  readonly locator?: string;
  readonly message?: string;
}

export interface IsoDocument {
  readonly rootName: string;
  readonly namespace: string;
  readonly containerName: string | null;
  readonly container: Readonly<Record<string, unknown>> | null;
}

export interface ValidationContext {
  readonly source: string;
  readonly parserKind: ParserKind;
  readonly iso?: IsoDocument;
  readonly edi?: EdiDocument;
}

export interface ValidationRule {
  readonly id: string;
  readonly description: string;
  readonly field: string;
  readonly defaultLocator: string;
  readonly evaluate: (context: ValidationContext) => RuleEvaluation;
}

export interface ReleaseApproval {
  readonly product: boolean;
  readonly sc: boolean;
  readonly ft: boolean;
  readonly rulesApproved: boolean;
  readonly fixturesApproved: boolean;
}

export interface FormatPack {
  readonly id: string;
  readonly family: FormatFamily;
  readonly label: string;
  readonly version: string | null;
  readonly parserKind: ParserKind;
  readonly extensions: readonly string[];
  readonly guideUrl: string | null;
  readonly enabled: boolean;
  readonly mode: FormatPackMode;
  readonly identifiers: VersionIdentifiers | null;
  readonly approval: ReleaseApproval;
  readonly releaseEvidence?: { readonly specificationRevision: string; readonly rulesetRevision: string; readonly fixtureRevision: string; readonly acceptanceRevision: string };
  readonly rules: readonly ValidationRule[];
}

export interface FormatVersionOption {
  readonly id: string;
  readonly label: string;
  readonly extensions: readonly string[];
  readonly validationProfileId?: string;
}

export interface FormatCatalogEntry {
  readonly id: string;
  readonly standard: string;
  readonly code: string;
  readonly name: string;
  readonly aliases: readonly string[];
  readonly status: CatalogStatus;
  readonly versions: readonly FormatVersionOption[];
}

export interface RuleResult {
  readonly location?: FindingLocation;
  readonly ruleId: string;
  readonly outcome: RuleOutcome;
  readonly severity: FindingSeverity | null;
  readonly field: string;
  readonly locator: string;
  readonly message: string;
  readonly ordinal: number;
}

export interface ValidationRun {
  readonly provenance?: RunProvenance;
  readonly checks?: readonly CheckEvaluation[];
  readonly executionReason?: string;
  readonly executionStatus?: "COMPLETED" | "INCOMPLETE" | "UNSUPPORTED";
  readonly verdict?: "PASS" | "PASS_WITH_WARNINGS" | "FAIL" | null;
  readonly fileName: string;
  readonly formatId: string;
  readonly formatLabel: string;
  readonly version: string;
  readonly results: readonly RuleResult[];
  readonly errorCount: number;
  readonly warningCount: number;
  readonly overallStatus: OverallStatus;
}

export interface EdiSegment {
  readonly id: string;
  readonly elements: readonly string[];
  readonly position: number;
}

export interface EdiDocument {
  readonly groups?: readonly import("./parsers/edi").EdiGroup[];
  readonly elementSeparator: string;
  readonly componentSeparator: string;
  readonly segmentTerminator: string;
  readonly segments: readonly EdiSegment[];
}

export interface WorkerRequest {
  readonly type: "validate";
  readonly packId: string;
  readonly fileName: string;
  readonly bytes: ArrayBuffer;
  readonly includeExplorer?: boolean;
  readonly includeFindingLines?: boolean;
  readonly snapshotId?: number;
}

export type WorkerResponse =
  | {
      readonly type: "complete";
      readonly run: ValidationRun;
      readonly source?: string;
      readonly snapshotId?: number;
      readonly explorerPending?: boolean;
    }
  | {
      readonly type: "explorer-ready";
      readonly snapshotId: number;
      readonly locations: readonly FindingLocationEntry[];
      readonly lines?: readonly FindingLineEntry[];
    }
  | { readonly type: "explorer-error"; readonly snapshotId: number }
  | { readonly type: "error"; readonly code: WorkerFailureCode };

export interface CoverageRule {
  readonly id: string;
  readonly description: string;
  readonly ruleClass: "xml-syntax" | "demo-structure" | "iso-schema" | "nacha-structure" | "advisory" | "tool-policy";
  readonly severity: "ERROR" | "WARNING";
  readonly applicability: string;
  readonly prerequisite: string;
  readonly reference: string;
  readonly evidence: string;
}
export interface CheckEvaluation {
  readonly ruleId: string;
  readonly state: "passed" | "failed" | "not-applicable" | "not-evaluated";
  readonly findingOrdinals: readonly number[];
}
export interface RunProvenance {
  readonly schemaVersion: "2";
  readonly profileId: string;
  readonly messageVersion: string;
  readonly implementationGuideRevision: string;
  readonly mode: FormatPackMode;
  readonly rulesetRevision: string;
  readonly coverageRevision: string;
  readonly buildRevision: string;
  readonly coverage: readonly CoverageRule[];
  readonly exclusions: readonly string[];
}
