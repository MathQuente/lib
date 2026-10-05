import { fetchWithTimeout } from '../utils/fetch-with-timeout'
import { mapWithConcurrency } from '../utils/map-with-concurrency'

const OPENXBL_BASE_URL = 'https://xbl.io/api/v2'
const CATALOG_LOOKUP_URL =
  'https://displaycatalog.mp.microsoft.com/v7.0/products/lookup'
const CATALOG_LOOKUP_CONCURRENCY = 10
const PC_ONLY_DEVICE = 'Win32'
const STATS_BATCH_SIZE = 100
const MINUTES_PLAYED_STAT = 'MinutesPlayed'

export interface XboxProfile {
  xuid: string
  gamertag: string
}

export interface XboxTitle {
  titleId: string
  name: string
  devices: string[]
  pfn: string | null
  lastPlayedAt: Date | null
  achievementProgress: number
  achievementsEarned: number
  achievementsTotal: number
  gamerscoreEarned: number
  gamerscoreTotal: number
}

export interface XboxUnlockedAchievement {
  description: string
  unlockedAt: Date
}

export class XboxApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'XboxApiError'
  }
}

interface OpenXblPerson {
  xuid?: string
  gamertag?: string
  uniqueModernGamertag?: string
}

interface OpenXblTitle {
  titleId?: string
  name?: string
  pfn?: string | null
  devices?: string[] | null
  achievement?: {
    progressPercentage?: number
    currentAchievements?: number
    totalAchievements?: number
    currentGamerscore?: number
    totalGamerscore?: number
  } | null
  titleHistory?: { lastTimePlayed?: string } | null
}

interface OpenXblAchievement {
  progressState?: string
  description?: string
  progression?: { timeUnlocked?: string } | null
}

interface OpenXblStat {
  titleid?: string
  name?: string
  value?: string
}

function gamertagKey(gamertag: string) {
  return gamertag.replace(/[#\s]/g, '').toLowerCase()
}

function isPcOnly(title: OpenXblTitle) {
  const devices = title.devices ?? []
  return devices.length > 0 && devices.every(d => d === PC_ONLY_DEVICE)
}

export class XboxApiService {
  private async request<T>(path: string, payload?: unknown): Promise<T> {
    const apiKey = process.env.OPENXBL_API_KEY
    if (!apiKey) throw new XboxApiError('OPENXBL_API_KEY is not set')

    let response: Response
    try {
      response = await fetchWithTimeout(`${OPENXBL_BASE_URL}${path}`, {
        method: payload === undefined ? 'GET' : 'POST',
        headers: {
          'X-Authorization': apiKey,
          Accept: 'application/json',
          'Accept-Language': 'en-US',
          ...(payload === undefined
            ? {}
            : { 'Content-Type': 'application/json' })
        },
        body: payload === undefined ? undefined : JSON.stringify(payload)
      })
    } catch (err) {
      throw new XboxApiError(err instanceof Error ? err.message : String(err))
    }

    if (!response.ok) {
      throw new XboxApiError(
        `OpenXBL responded ${response.status} for ${path.split('/')[1]}`,
        response.status
      )
    }

    const body = (await response.json()) as { content?: T } & T
    return body.content ?? body
  }

  async findProfile(gamertag: string): Promise<XboxProfile | null> {
    const { people } = await this.request<{ people?: OpenXblPerson[] }>(
      `/search/${encodeURIComponent(gamertag)}`
    )

    const wanted = gamertagKey(gamertag)
    const person = (people ?? []).find(
      p =>
        (p.gamertag && gamertagKey(p.gamertag) === wanted) ||
        (p.uniqueModernGamertag &&
          gamertagKey(p.uniqueModernGamertag) === wanted)
    )
    if (!person?.xuid || !person.gamertag) return null

    return { xuid: person.xuid, gamertag: person.gamertag }
  }

  async getTitleHistory(xuid: string): Promise<XboxTitle[]> {
    const { titles } = await this.request<{ titles?: OpenXblTitle[] }>(
      `/titles/${encodeURIComponent(xuid)}`
    )

    const games: XboxTitle[] = []
    for (const title of titles ?? []) {
      if (!title.titleId || !title.name || isPcOnly(title)) continue
      games.push({
        titleId: title.titleId,
        name: title.name,
        devices: title.devices ?? [],
        pfn: title.pfn ?? null,
        lastPlayedAt: title.titleHistory?.lastTimePlayed
          ? new Date(title.titleHistory.lastTimePlayed)
          : null,
        achievementProgress: title.achievement?.progressPercentage ?? 0,
        achievementsEarned: title.achievement?.currentAchievements ?? 0,
        achievementsTotal: title.achievement?.totalAchievements ?? 0,
        gamerscoreEarned: title.achievement?.currentGamerscore ?? 0,
        gamerscoreTotal: title.achievement?.totalGamerscore ?? 0
      })
    }
    return games
  }

  async getUnlockedAchievements(
    xuid: string,
    titleId: string
  ): Promise<XboxUnlockedAchievement[]> {
    const { achievements } = await this.request<{
      achievements?: OpenXblAchievement[]
    }>(
      `/achievements/player/${encodeURIComponent(xuid)}/${encodeURIComponent(titleId)}`
    )

    return (achievements ?? []).flatMap(achievement => {
      if (achievement.progressState !== 'Achieved') return []
      const unlockedAt = new Date(achievement.progression?.timeUnlocked ?? '')
      if (Number.isNaN(unlockedAt.getTime()) || unlockedAt.getFullYear() < 2005) {
        return []
      }
      return [{ description: achievement.description ?? '', unlockedAt }]
    })
  }

  async getMinutesPlayed(
    xuid: string,
    titleIds: string[]
  ): Promise<Map<string, number>> {
    const minutes = new Map<string, number>()

    for (let i = 0; i < titleIds.length; i += STATS_BATCH_SIZE) {
      const batch = titleIds.slice(i, i + STATS_BATCH_SIZE)
      const { statlistscollection } = await this.request<{
        statlistscollection?: { stats?: OpenXblStat[] }[]
      }>('/player/stats', {
        xuids: [xuid],
        stats: batch.map(titleId => ({ name: MINUTES_PLAYED_STAT, titleId }))
      })

      for (const stat of statlistscollection?.flatMap(c => c.stats ?? []) ?? []) {
        const value = Number(stat.value)
        if (stat.titleid && stat.value !== undefined && Number.isFinite(value)) {
          minutes.set(stat.titleid, value)
        }
      }
    }

    return minutes
  }

  async resolveProductIds(pfns: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(pfns)]
    const productIds = await mapWithConcurrency(
      unique,
      CATALOG_LOOKUP_CONCURRENCY,
      pfn => this.lookupProductId(pfn)
    )

    const result = new Map<string, string>()
    unique.forEach((pfn, index) => {
      const productId = productIds[index]
      if (productId) result.set(pfn, productId)
    })
    return result
  }

  private async lookupProductId(pfn: string): Promise<string | null> {
    try {
      const response = await fetchWithTimeout(
        `${CATALOG_LOOKUP_URL}?alternateId=PackageFamilyName&value=${encodeURIComponent(pfn)}&market=US&languages=en-US`
      )
      if (!response.ok) return null
      const body = (await response.json()) as {
        Products?: { ProductId?: string }[]
      }
      return body.Products?.[0]?.ProductId ?? null
    } catch {
      return null
    }
  }
}
