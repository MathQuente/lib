import {
  AuthorizationPayload,
  getProfileFromUserName,
  getUserPlayedGames,
  getUserTitles,
  getUserTrophiesForSpecificTitle,
  TrophyTitle,
  UserTrophiesBySpecificTitleResponse
} from 'psn-api'
import { PsnAuthService } from './psn-auth.service'

const PLAYED_GAMES_PAGE_SIZE = 200
const TROPHY_TITLES_PAGE_SIZE = 800
const SPECIFIC_TITLE_BATCH_SIZE = 5
const GAME_CATEGORIES = new Set(['ps4_game', 'ps5_native_game', 'unknown'])

export interface PsnPlayedGame {
  titleId: string
  conceptId: string | null
  name: string
  playMinutes: number
  lastPlayedAt: Date | null
}

export interface PsnTrophySummary {
  progress: number
  hasPlatinum: boolean
  lastTrophyAt: Date | null
}

export class PsnApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PsnApiError'
  }
}

export function parseIsoDurationToMinutes(duration: string | undefined): number {
  if (!duration) return 0
  const match = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(
    duration
  )
  if (!match) return 0
  const [, days, hours, minutes, seconds] = match
  return (
    Number(days ?? 0) * 24 * 60 +
    Number(hours ?? 0) * 60 +
    Number(minutes ?? 0) +
    Math.round(Number(seconds ?? 0) / 60)
  )
}

export function normalizeGameName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function toTrophySummary(title: TrophyTitle): PsnTrophySummary {
  return {
    progress: title.progress,
    hasPlatinum: (title.earnedTrophies?.platinum ?? 0) > 0,
    lastTrophyAt: title.lastUpdatedDateTime
      ? new Date(title.lastUpdatedDateTime)
      : null
  }
}

function isInvalidTokenMessage(message: string) {
  return /invalid token|expired token|unauthori[sz]ed/i.test(message)
}

export class PsnApiService {
  constructor(private psnAuthService: PsnAuthService) {}

  private async call<T>(
    fn: (auth: AuthorizationPayload) => Promise<T>,
    retried = false
  ): Promise<T> {
    const auth = await this.psnAuthService.getAuthorization()

    let message: string | null = null
    let result: T | undefined
    try {
      result = await fn(auth)
      const error = (result as { error?: { message?: string } } | undefined)
        ?.error
      if (error) message = error.message ?? 'Unknown PSN error'
    } catch (err) {
      message = err instanceof Error ? err.message : String(err)
    }

    if (message === null) return result as T

    if (!retried && isInvalidTokenMessage(message)) {
      await this.psnAuthService.invalidateAccessToken()
      return this.call(fn, true)
    }
    throw new PsnApiError(message)
  }

  async findProfile(
    onlineId: string
  ): Promise<{ accountId: string; onlineId: string } | null> {
    try {
      const { profile } = await this.call(auth =>
        getProfileFromUserName(auth, onlineId)
      )
      return { accountId: profile.accountId, onlineId: profile.onlineId }
    } catch (err) {
      if (err instanceof PsnApiError && /not found/i.test(err.message)) {
        return null
      }
      throw err
    }
  }

  async getPlayedGames(accountId: string): Promise<PsnPlayedGame[]> {
    const games: PsnPlayedGame[] = []
    let offset = 0

    while (true) {
      const page = await this.call(auth =>
        getUserPlayedGames(auth, accountId, {
          limit: PLAYED_GAMES_PAGE_SIZE,
          offset
        })
      )

      for (const title of page.titles) {
        if (!GAME_CATEGORIES.has(title.category)) continue
        games.push({
          titleId: title.titleId,
          conceptId: title.concept?.id != null ? String(title.concept.id) : null,
          name: title.name,
          playMinutes: parseIsoDurationToMinutes(title.playDuration),
          lastPlayedAt: title.lastPlayedDateTime
            ? new Date(title.lastPlayedDateTime)
            : null
        })
      }

      if (
        page.nextOffset == null ||
        page.titles.length === 0 ||
        offset + page.titles.length >= page.totalItemCount
      ) {
        break
      }
      offset = page.nextOffset
    }

    return games
  }

  async getTrophySummariesByName(
    accountId: string
  ): Promise<Map<string, PsnTrophySummary>> {
    const summaries = new Map<string, PsnTrophySummary>()
    let offset = 0

    while (true) {
      const page = await this.call(auth =>
        getUserTitles(auth, accountId, {
          limit: TROPHY_TITLES_PAGE_SIZE,
          offset
        })
      )

      for (const title of page.trophyTitles) {
        const key = normalizeGameName(title.trophyTitleName)
        if (!summaries.has(key)) summaries.set(key, toTrophySummary(title))
      }

      if (page.nextOffset == null || page.trophyTitles.length === 0) break
      offset = page.nextOffset
    }

    return summaries
  }

  async getTrophySummariesByTitleId(
    accountId: string,
    titleIds: string[]
  ): Promise<Map<string, PsnTrophySummary>> {
    const summaries = new Map<string, PsnTrophySummary>()

    for (let i = 0; i < titleIds.length; i += SPECIFIC_TITLE_BATCH_SIZE) {
      const batch = titleIds.slice(i, i + SPECIFIC_TITLE_BATCH_SIZE)
      const titles = await this.fetchSpecificTitles(accountId, batch)

      for (const { npTitleId, trophyTitles } of titles) {
        const first = trophyTitles?.[0]
        if (first) summaries.set(npTitleId, toTrophySummary(first))
      }
    }

    return summaries
  }

  private async fetchSpecificTitles(
    accountId: string,
    titleIds: string[]
  ): Promise<UserTrophiesBySpecificTitleResponse['titles']> {
    try {
      const response = await this.call(auth =>
        getUserTrophiesForSpecificTitle(auth, accountId, {
          npTitleIds: titleIds.join(',')
        })
      )
      return response.titles ?? []
    } catch (err) {
      if (!(err instanceof PsnApiError)) throw err
      if (titleIds.length === 1) return []

      const results = await Promise.all(
        titleIds.map(id => this.fetchSpecificTitles(accountId, [id]))
      )
      return results.flat()
    }
  }
}
