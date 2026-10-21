// Names compared the way a person compares them: accents, Arabic letter variants, spacing and case do not matter,
// and one wrong letter (an OCR error) costs a little, not everything. Used by the student directory (search, suggestions,
// matching a scanned card to a student) in the main process.

/** lower case, no accents, no Arabic diacritics, Arabic letter variants unified, only letters and digits, single spaces */
export function normName(s: string): string {
  return s
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/** classic edit distance */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    prev = cur
  }
  return prev[b.length]
}

const ratio = (a: string, b: string): number => (a || b ? 1 - editDistance(a, b) / Math.max(a.length, b.length) : 0)

/**
 * 0..1: how alike two names are. Compared as a whole without spaces ("ben youcef" = "benyoucef") and word by word in any
 * order ("Khadidja Benyoucef" = "Benyoucef Khadidja"); the better of the two counts.
 */
export function nameSimilarity(a: string, b: string): number {
  const na = normName(a)
  const nb = normName(b)
  if (!na || !nb) return 0
  const whole = ratio(na.replace(/ /g, ''), nb.replace(/ /g, ''))
  const ta = na.split(' ')
  const tb = nb.split(' ')
  const best = (from: string[], to: string[]): number => from.reduce((sum, w) => sum + Math.max(...to.map((x) => ratio(w, x))), 0) / from.length
  const words = (best(ta, tb) + best(tb, ta)) / 2
  return Math.max(whole, words)
}
