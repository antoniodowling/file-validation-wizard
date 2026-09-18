import { VALIDATION_DEADLINE_MS, type ValidationFailureCode } from "./types";

const messages: Readonly<Record<ValidationFailureCode, string>> = {
  FILE_TOO_LARGE: "Validation did not run: this file exceeds the 25 MB limit. Choose a smaller file.",
  PROFILE_UNAVAILABLE: "Validation did not run: the selected format version is unavailable. Choose another version.",
  INVALID_ENCODING: "Validation did not run: the file could not be decoded as UTF-8. Save a UTF-8 copy and try again.",
  ENGINE_ERROR: "Validation could not complete because the validation engine encountered an error. No validation result is available.",
  FILE_READ_ERROR: "Validation did not run: the browser could not read this file. Choose the file again and retry.",
  WORKER_UNAVAILABLE: "Validation could not start because the browser could not open the local validation worker. Check the page's browser/security configuration.",
  WORKER_ERROR: "Validation could not complete because the local validation worker failed. No validation result is available. You can retry.",
  TIMEOUT: `Validation stopped after ${VALIDATION_DEADLINE_MS / 1000} seconds. No validation result is available. Try a smaller file or check its structure before retrying.`,
};

export function validationFailureMessage(code: ValidationFailureCode): string {
  return messages[code];
}
