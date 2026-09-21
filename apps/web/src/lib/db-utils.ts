export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size))
  }
  return out
}

// D1 allows at most 100 bound parameters per statement.
export const ID_CHUNK = 90
export const ROW_CHUNK = 40
