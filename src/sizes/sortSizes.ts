import type { Size } from './types'

// "150 x 900" must come before "1000 x 1000", so compare the numbers inside the name
// (width, then height) rather than the raw string.
function sizeNumbers(name: string): number[] {
  return (name.match(/\d+/g) ?? []).map(Number)
}

export function compareSizes(a: Size, b: Size): number {
  const an = sizeNumbers(a.name)
  const bn = sizeNumbers(b.name)
  for (let i = 0; i < Math.max(an.length, bn.length); i++) {
    const diff = (an[i] ?? -1) - (bn[i] ?? -1)
    if (diff !== 0) return diff
  }
  return a.name.localeCompare(b.name)
}

export function sortSizes(sizes: Size[]): Size[] {
  return [...sizes].sort(compareSizes)
}
