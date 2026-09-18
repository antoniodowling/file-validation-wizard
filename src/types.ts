export const MAX_FILE_BYTES = 25_000_000;
export const VALIDATION_DEADLINE_MS = 10_000;

export type WorkerFailureCode = "FILE_TOO_LARGE" | "PROFILE_UNAVAILABLE" | "INVALID_ENCODING" | "ENGINE_ERROR";
export type ValidationFailureCode = WorkerFailureCode | "FILE_READ_ERROR" | "WORKER_UNAVAILABLE" | "WORKER_ERROR" | "TIMEOUT";

export type FormatFamily = "PAIN.001" | "PAIN.008" | "EDI 820";
export type ParserKind = "ISO_XML" | "EDI_X12";
export type FormatPackMode = "DEMO" | "PRODUCTION";
export type CatalogStatus = "DEMO_SUPPORTED" | "REFERENCE_ONLY";
export type RuleOutcome = "PASS" | "ERROR" | "WARNING";
export type FindingSeverity = "ERROR" | "WARNING";
export type OverallStatus = "PASS" | "PASS_WITH_WARNINGS" | "FAIL";

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

export type VersionIdentifiers = IsoVersionIdentifiers | EdiVersionIdentifiers;

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
  readonly ruleId: string;
  readonly outcome: RuleOutcome;
  readonly severity: FindingSeverity | null;
  readonly field: string;
  readonly locator: string;
  readonly message: string;
  readonly ordinal: number;
}

export interface ValidationRun {
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
}

export type WorkerResponse =
  | { readonly type: "complete"; readonly run: ValidationRun }
  | { readonly type: "error"; readonly code: WorkerFailureCode };
