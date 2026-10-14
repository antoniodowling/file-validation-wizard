// Provisional guard for source-location indexing, separate from full-source
// display and the worker's file-size limit. Beyond this guard, validation and
// full-source browsing remain available while finding locations may be unavailable.
export const MAX_SOURCE_INDEX_CHARACTERS = 5_000_000;
