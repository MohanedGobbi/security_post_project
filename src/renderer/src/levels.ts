import { useCallback, useEffect, useState } from 'react'
import type { Labels, Level } from '@shared/types'

/** The permission levels (guard, team leader, administrator and the ones the administrator made), for names and choices. */
export function useLevels(): { levels: Level[]; reload(): void } {
  const [levels, setLevels] = useState<Level[]>([])
  const reload = useCallback(() => {
    window.api.levels.list().then(setLevels).catch(() => undefined)
  }, [])
  useEffect(reload, [reload])
  return { levels, reload }
}

/** The name of a level in the language asked, falling back to another language, then to its key */
export function levelName(levels: Level[], key: string, lang: string): string {
  const l = levels.find((x) => x.key === key)
  if (!l) return key
  const labels: Labels = l.labels
  return labels[lang as keyof Labels] || labels.ar || labels.fr || labels.en || key
}
