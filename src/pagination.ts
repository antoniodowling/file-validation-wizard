export interface PageWindow {
  readonly page: number;
  readonly pageCount: number;
  readonly start: number;
  readonly end: number;
}

export function pageWindow(totalItems: number, requestedPage: number, pageSize: number): PageWindow {
  if (!Number.isInteger(pageSize) || pageSize <= 0) throw new Error("Page size must be a positive integer.");
  const total = Math.max(0, Math.floor(totalItems));
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(pageCount, Math.max(1, Math.floor(requestedPage) || 1));
  const start = total === 0 ? 0 : (page - 1) * pageSize;
  const end = Math.min(total, start + pageSize);
  return Object.freeze({ page, pageCount, start, end });
}
