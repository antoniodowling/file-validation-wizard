const declarationOpener = String.fromCharCode(60, 33);
export interface ProhibitedDeclarationMatch { readonly index: number; readonly length: number }
/** Security preflight only, never a substitute for the strict XML parser. */
export function findProhibitedDeclaration(source: string): ProhibitedDeclarationMatch | null {
  let index = 0;
  while ((index = source.indexOf("<", index)) >= 0) {
    const skips: readonly [string, string][] = [[declarationOpener + "--", "-->"], [declarationOpener + "[CDATA[", "]]>"], ["<?", "?>"]];
    const skip = skips.find(([open]) => source.startsWith(open, index));
    if (skip) {
      const end = source.indexOf(skip[1], index + skip[0].length);
      if (end < 0) return null; // Strict parser diagnoses the unterminated construct.
      index = end + skip[1].length;
      continue;
    }
    for (const name of ["DOCTYPE", "ENTITY"]) {
      const marker = declarationOpener + name;
      if (source.slice(index, index + marker.length).toUpperCase() === marker) return { index, length: marker.length };
    }
    index += 1;
  }
  return null;
}
