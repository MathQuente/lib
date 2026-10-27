import { IGDBGame } from '../types/igdb'

export const MIN_ACHIEVEMENTS_FOR_SIGNAL = 5
export const RARE_ACHIEVEMENT_PERCENT = 5
export const MAX_ACHIEVEMENTS_FOR_RARITY_SIGNAL = 100
export const MIN_RATIO_FOR_PLAYTIME_SIGNAL = 0.25
export const PLAYTIME_TO_BEAT_FACTOR = 1
export const MIN_RATIO_FOR_SUGGESTION = 0.1

const RATIO_THRESHOLDS: { maxTotal: number; ratio: number }[] = [
  { maxTotal: 10, ratio: 0.9 },
  { maxTotal: 30, ratio: 0.7 },
  { maxTotal: 75, ratio: 0.4 },
  { maxTotal: 150, ratio: 0.3 },
  { maxTotal: Infinity, ratio: 0.15 }
]

export function requiredRatioForTotal(total: number): number {
  return RATIO_THRESHOLDS.find(t => total <= t.maxTotal)!.ratio
}

export function meetsCompletionRatio(earned: number, total: number): boolean {
  return (
    total >= MIN_ACHIEVEMENTS_FOR_SIGNAL &&
    earned / total >= requiredRatioForTotal(total)
  )
}

export const COMPLETION_KEYWORD_PATTERN =
  /\bending\b|\bfinal boss\b|\bcomplete(d)? the (main )?(game|story|storyline|campaign)\b|\bbeat the game\b|\bfinish(ed)? the (main )?(game|story|storyline|campaign)\b|\bcredits\b|\bepilogue\b|\bfinal (mission|chapter|level|stage|battle)\b|\bfinale\b/i

export function hasSinglePlayerMode(game: IGDBGame): boolean {
  const modes = game.game_modes?.map(m => m.name.toLowerCase())
  if (!modes || modes.length === 0) return true
  return modes.includes('single player')
}

const OPEN_ENDED_GENRES = new Set(['sport', 'racing'])
const MULTIPLAYER_MODE_PATTERN = /multiplayer|co-operative|massively|battle royale/i

export function hasMultiplayerMode(game: IGDBGame): boolean {
  return game.game_modes?.some(m => MULTIPLAYER_MODE_PATTERN.test(m.name)) ?? false
}

function isOpenEnded(game: IGDBGame): boolean {
  const openEndedGenre =
    game.genres?.some(g => OPEN_ENDED_GENRES.has(g.name.toLowerCase())) ?? false
  return openEndedGenre && hasMultiplayerMode(game)
}

const NARRATIVE_GENRES = new Set(['adventure', 'role-playing (rpg)', 'visual novel'])
const PARTY_THEME = 'party'

function lacksCampaign(game: IGDBGame): boolean {
  if (!hasMultiplayerMode(game)) return false
  const isParty = game.themes?.some(t => t.name.toLowerCase() === PARTY_THEME) ?? false
  if (isParty) return true
  if (!game.genres || game.genres.length === 0) return false
  return !game.genres.some(g => NARRATIVE_GENRES.has(g.name.toLowerCase()))
}

export function canInferCompletion(game: IGDBGame): boolean {
  return hasSinglePlayerMode(game) && !isOpenEnded(game) && !lacksCampaign(game)
}

export const MIN_CHAPTERS_FOR_SEQUENCE = 5

const CHAPTER_NAME_PATTERN = /^(.*?(?:chapter|ch|c))_?(\d+)$/i

export function completedChapterSequenceEnd(
  schemaApiNames: string[],
  achieved: { apiNames: string[]; unlockTimes: Map<string, number> }
): string | null {
  const groups = new Map<string, Map<number, string>>()
  for (const name of schemaApiNames) {
    const match = CHAPTER_NAME_PATTERN.exec(name)
    if (!match) continue
    const prefix = match[1].toLowerCase()
    const chapters = groups.get(prefix) ?? new Map<number, string>()
    chapters.set(Number(match[2]), name)
    groups.set(prefix, chapters)
  }

  const unlocked = new Set(achieved.apiNames)
  for (const chapters of groups.values()) {
    const last = Math.max(...chapters.keys())
    const first = Math.min(...chapters.keys())
    const count = chapters.size
    if (first > 1 || count !== last - first + 1 || count < MIN_CHAPTERS_FOR_SEQUENCE) {
      continue
    }
    const ordered = Array.from({ length: count }, (_, i) => chapters.get(first + i)!)
    if (!ordered.every(name => unlocked.has(name))) continue

    const times = ordered.map(name => achieved.unlockTimes.get(name) ?? 0)
    const inOrder = times.every((time, i) => time > 0 && (i === 0 || time >= times[i - 1]))
    if (!inOrder) continue

    return ordered[ordered.length - 1]
  }
  return null
}

export function meetsPlaytimeSignal({
  hoursPlayed,
  normallyHours,
  achieved,
  total
}: {
  hoursPlayed: number
  normallyHours: number | undefined
  achieved: number
  total: number
}): boolean {
  if (!normallyHours || normallyHours <= 0) return false
  if (total < MIN_ACHIEVEMENTS_FOR_SIGNAL) return false
  return (
    hoursPlayed >= normallyHours * PLAYTIME_TO_BEAT_FACTOR &&
    achieved / total >= MIN_RATIO_FOR_PLAYTIME_SIGNAL
  )
}

const PLAIN_END_PATTERN =
  /\b(finish(ed)?|complete(d)?|beat) the (main )?(game|story|storyline|campaign)\b/i
const QUALIFIED_END_PATTERN =
  /difficulty|hardcore|\bmode\b|new game\s?\+|\bwithout\b|\bin \d+\b|\bunder \d+\b|\bwithin\b|\ball\b|\bevery\b/i

export const OPEN_ENDED_TIME_TO_BEAT_HOURS = 300

export function isPlainEndAchievement(text: string): boolean {
  return PLAIN_END_PATTERN.test(text) && !QUALIFIED_END_PATTERN.test(text)
}

export function hasLockedPlainEndAchievement(
  schema: Map<string, string> | null,
  achievedApiNames: string[]
): boolean {
  if (!schema) return false
  const unlocked = new Set(achievedApiNames)
  for (const [name, text] of schema) {
    if (!unlocked.has(name) && isPlainEndAchievement(text)) return true
  }
  return false
}

export function hasPracticalEnd(normallyHours: number | undefined): boolean {
  return normallyHours === undefined || normallyHours < OPEN_ENDED_TIME_TO_BEAT_HOURS
}

export type FinishSignal = 'heuristic' | 'playtime'

export interface FinishSuggestion {
  suggest: boolean
  lowConfidence: boolean
  signals: FinishSignal[]
}

export function evaluateFinishSuggestion({
  game,
  hoursPlayed,
  normallyHours,
  achieved,
  total,
  heuristicFinished,
  weakSignalsBlocked = false
}: {
  game: IGDBGame
  hoursPlayed: number
  normallyHours: number | undefined
  achieved: number | null
  total: number | null
  heuristicFinished: boolean
  weakSignalsBlocked?: boolean
}): FinishSuggestion {
  const none: FinishSuggestion = {
    suggest: false,
    lowConfidence: false,
    signals: []
  }
  if (!canInferCompletion(game) || weakSignalsBlocked) return none

  const signals: FinishSignal[] = []
  if (heuristicFinished) signals.push('heuristic')

  const playtimeSuggests =
    achieved != null &&
    total != null &&
    normallyHours != null &&
    normallyHours > 0 &&
    total >= MIN_ACHIEVEMENTS_FOR_SIGNAL &&
    hoursPlayed >= normallyHours * PLAYTIME_TO_BEAT_FACTOR &&
    achieved / total >= MIN_RATIO_FOR_SUGGESTION
  if (playtimeSuggests) signals.push('playtime')

  if (signals.length === 0) return none
  return { suggest: true, lowConfidence: hasMultiplayerMode(game), signals }
}
