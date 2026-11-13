import { GAME_STATUS } from './game-status'

export type ReleaseDateChangeKind =
  | 'igual'
  | 'ja_lancado'
  | 'outra_data_futura'
  | 'adiado_para_o_futuro'
  | 'outra_data_passada'
  | 'data_removida'
  | 'data_removida_ignorada'
  | 'data_adicionada'

export interface ReleaseDateClassification {
  kind: ReleaseDateChangeKind
  writes: boolean
  newReleaseDate: number | null
}

export function classifyReleaseDateChange(input: {
  cacheReleaseDate: number | null
  igdbReleaseDate: number | null
  igdbGameStatus: number | null
  nowEpoch: number
}): ReleaseDateClassification {
  const { cacheReleaseDate, igdbReleaseDate, igdbGameStatus, nowEpoch } = input

  if (cacheReleaseDate === igdbReleaseDate) {
    return { kind: 'igual', writes: false, newReleaseDate: cacheReleaseDate }
  }

  if (igdbReleaseDate === null) {
    return igdbGameStatus === GAME_STATUS.RELEASED
      ? { kind: 'data_removida', writes: true, newReleaseDate: null }
      : {
          kind: 'data_removida_ignorada',
          writes: false,
          newReleaseDate: cacheReleaseDate
        }
  }

  if (cacheReleaseDate === null) {
    return {
      kind: 'data_adicionada',
      writes: true,
      newReleaseDate: igdbReleaseDate
    }
  }

  const cacheIsFuture = cacheReleaseDate > nowEpoch
  const igdbIsFuture = igdbReleaseDate > nowEpoch
  const kind: ReleaseDateChangeKind = cacheIsFuture
    ? igdbIsFuture
      ? 'outra_data_futura'
      : 'ja_lancado'
    : igdbIsFuture
      ? 'adiado_para_o_futuro'
      : 'outra_data_passada'

  return { kind, writes: true, newReleaseDate: igdbReleaseDate }
}
