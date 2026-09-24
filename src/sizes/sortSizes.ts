import type { Size } from './types'

// "150 x 900" must come before "1000 x 1000", so compare the numbers inside the name
// (width, then height) rather than the raw string.
function sizeNumbers(name: string): number[] {
  return (name.match(/\d+/g) ?? []).map(Number)
}

export function compareSizeNames(a: string, b: string): number {
  const an = sizeNumbers(a)
  const bn = sizeNumbers(b)
  for (let i = 0; i < Math.max(an.length, bn.length); i++) {
    const diff = (an[i] ?? -1) - (bn[i] ?? -1)
    if (diff !== 0) return diff
  }
  return a.localeCompare(b)
}

export function sortSizes(sizes: Size[]): Size[] {
  return [...sizes].sort((a, b) => compareSizeNames(a.name, b.name))
}

// Anything carrying a size string (e.g. a company's manufacturing specification rows).
// Rows sharing a size keep their original relative order (Array.sort is stable).
export function sortBySize<T extends { size: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => compareSizeNames(a.size ?? '', b.size ?? ''))
}
