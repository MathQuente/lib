import { IGDBGame } from '../types/igdb'

export const MIN_ACHIEVEMENTS_FOR_SIGNAL = 5
export const RARE_ACHIEVEMENT_PERCENT = 5
export const MAX_ACHIEVEMENTS_FOR_RARITY_SIGNAL = 100
export const MIN_RATIO_FOR_PLAYTIME_SIGNAL = 0.25
export const PLAYTIME_TO_BEAT_FACTOR = 1

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
  /\bending\b|\bfinal boss\b|\bcomplete(d)? the game\b|\bbeat the game\b|\bfinish(ed)? the (game|story|campaign)\b|\bcredits\b|\bepilogue\b|\bfinal (mission|chapter|level|stage|battle)\b|\bfinale\b/i

export function hasSinglePlayerMode(game: IGDBGame): boolean {
  const modes = game.game_modes?.map(m => m.name.toLowerCase())
  if (!modes || modes.length === 0) return true
  return modes.includes('single player')
}

const OPEN_ENDED_GENRES = new Set(['sport', 'racing'])
const MULTIPLAYER_MODE_PATTERN = /multiplayer|co-operative|massively|battle royale/i

function hasMultiplayerMode(game: IGDBGame): boolean {
  return game.game_modes?.some(m => MULTIPLAYER_MODE_PATTERN.test(m.name)) ?? false
}

function isOpenEnded(game: IGDBGame): boolean {
  const openEndedGenre =
    game.genres?.some(g => OPEN_ENDED_GENRES.has(g.name.toLowerCase())) ?? false
  return openEndedGenre && hasMultiplayerMode(game)
}

export function canInferCompletion(game: IGDBGame): boolean {
  return hasSinglePlayerMode(game) && !isOpenEnded(game)
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
