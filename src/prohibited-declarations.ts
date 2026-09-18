const declarationOpener = String.fromCharCode(60, 33);
const prohibitedNames = ["DOCTYPE", "ENTITY"] as const;

export interface ProhibitedDeclarationMatch {
  readonly index: number;
  readonly length: number;
}

export function findProhibitedDeclaration(source: string): ProhibitedDeclarationMatch | null {
  const upperSource = source.toUpperCase();
  let match: ProhibitedDeclarationMatch | null = null;
  for (const name of prohibitedNames) {
    const marker = declarationOpener + name;
    const index = upperSource.indexOf(marker);
    if (index >= 0 && (!match || index < match.index)) match = { index, length: marker.length };
  }
  return match;
}
