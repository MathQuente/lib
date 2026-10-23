export const GAME_STATUS = {
  RELEASED: 0,
  ALPHA: 2,
  BETA: 3,
  EARLY_ACCESS: 4,
  OFFLINE: 5,
  CANCELLED: 6,
  RUMORED: 7,
  DELISTED: 8
} as const

export function isHiddenFromCatalog(
  gameStatus: number | null | undefined,
  releaseDate: number | null | undefined
): boolean {
  if (gameStatus === GAME_STATUS.RUMORED) return true
  return gameStatus === GAME_STATUS.CANCELLED && releaseDate == null
}
