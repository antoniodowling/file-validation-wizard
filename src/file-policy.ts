import { extensionList } from "./format-catalog";
import { MAX_FILE_BYTES } from "./types";

export interface FileCandidate {
  readonly name: string;
  readonly size: number;
}

export function extensionOf(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

export function fileSelectionError(
  files: readonly FileCandidate[],
  allowedExtensions: readonly string[],
): string | null {
  if (files.length !== 1) {
    return "Choose exactly one file. The current selection has not changed.";
  }
  const candidate = files[0];
  if (!candidate) return "Choose exactly one file. The current selection has not changed.";
  const extension = extensionOf(candidate.name);
  if (!allowedExtensions.some((allowed) => allowed.toLowerCase() === extension)) {
    return `Unsupported file extension. Choose ${extensionList(allowedExtensions)}.`;
  }
  if (candidate.size > MAX_FILE_BYTES) {
    return "This file is larger than the 25 MB limit. The current selection has not changed.";
  }
  return null;
}
