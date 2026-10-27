import { fetchWithTimeout } from '../utils/fetch-with-timeout'

export interface SteamOwnedGame {
  appid: number
  name: string
  playtime_forever: number
  rtime_last_played?: number
}

export class SteamApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number
  ) {
    super(message)
    this.name = 'SteamApiError'
  }
}

export interface SteamAchievementSummary {
  achieved: number
  total: number
  achievedApiNames: string[]
  unlockTimesByName: Map<string, number>
}

const PERSONA_TIMEOUT_MS = 1_500
const ACHIEVEMENT_RETRY_DELAYS_MS = [400, 1_000]

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login'
const OPENID_IDENTIFIER_SELECT =
  'http://specs.openid.net/auth/2.0/identifier_select'
const OPENID_REQUIRED_SIGNED_FIELDS = [
  'claimed_id',
  'identity',
  'return_to',
  'response_nonce',
  'op_endpoint'
]

export class SteamApiService {
  static buildOpenIdLoginUrl(returnTo: string): string {
    const params = new URLSearchParams({
      'openid.ns': 'http://specs.openid.net/auth/2.0',
      'openid.mode': 'checkid_setup',
      'openid.return_to': returnTo,
      'openid.realm': new URL(returnTo).origin,
      'openid.identity': OPENID_IDENTIFIER_SELECT,
      'openid.claimed_id': OPENID_IDENTIFIER_SELECT
    })
    return `${STEAM_OPENID_ENDPOINT}?${params.toString()}`
  }

  static async verifyOpenIdAssertion(
    query: Record<string, unknown>,
    expectedReturnTo: string
  ): Promise<string | null> {
    const param = (name: string) => {
      const value = query[`openid.${name}`]
      return typeof value === 'string' ? value : ''
    }

    if (param('mode') !== 'id_res') return null
    if (param('op_endpoint') !== STEAM_OPENID_ENDPOINT) return null
    if (param('return_to') !== expectedReturnTo) return null

    const claimed = /^https:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/.exec(
      param('claimed_id')
    )
    if (!claimed || param('identity') !== param('claimed_id')) return null

    const signedFields = param('signed').split(',')
    if (OPENID_REQUIRED_SIGNED_FIELDS.some(f => !signedFields.includes(f))) {
      return null
    }

    const body = new URLSearchParams()
    for (const [key, value] of Object.entries(query)) {
      if (key.startsWith('openid.') && typeof value === 'string') {
        body.set(key, value)
      }
    }
    body.set('openid.mode', 'check_authentication')

    const response = await fetchWithTimeout(STEAM_OPENID_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    })
    if (!response.ok) return null

    const text = await response.text()
    return /^is_valid:true$/m.test(text) ? claimed[1] : null
  }

  private static getApiKey(): string {
    const key = process.env.STEAM_API_KEY
    if (!key) {
      throw new Error('STEAM_API_KEY environment variable is required')
    }
    return key
  }

  static async getPersonaName(steamId: string): Promise<string | null> {
    const url = `https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${this.getApiKey()}&steamids=${steamId}`
    const response = await fetchWithTimeout(url, {}, PERSONA_TIMEOUT_MS)

    if (!response.ok) return null

    const data = (await response.json()) as {
      response?: { players?: { personaname?: string }[] }
    }

    return data.response?.players?.[0]?.personaname ?? null
  }

  static async getOwnedGames(
    steamId: string
  ): Promise<SteamOwnedGame[] | null> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${this.getApiKey()}&steamid=${steamId}&include_appinfo=1&format=json`
    let response: Response
    try {
      response = await fetchWithTimeout(url)
    } catch (err) {
      throw new SteamApiError(err instanceof Error ? err.message : String(err))
    }

    if (!response.ok) {
      throw new SteamApiError(
        `Steam responded ${response.status} for GetOwnedGames`,
        response.status
      )
    }

    const data = (await response.json()) as {
      response?: { game_count?: number; games?: SteamOwnedGame[] }
    }

    if (!data.response?.games) return null

    return data.response.games
  }

  static async getWishlist(
    steamId: string
  ): Promise<{ appid: number }[] | null> {
    const url = `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?key=${this.getApiKey()}&steamid=${steamId}`
    const response = await fetchWithTimeout(url)

    if (!response.ok) return null

    const data = (await response.json()) as {
      response?: { items?: { appid: number }[] }
    }

    if (!data.response?.items) return null

    return data.response.items
  }

  private static async fetchAchievementData(url: string): Promise<Response | null> {
    for (let attempt = 0; ; attempt++) {
      let response: Response | null = null
      try {
        response = await fetchWithTimeout(url)
      } catch {
        response = null
      }

      const retryable =
        response === null || response.status === 429 || response.status >= 500
      if (!retryable) return response
      if (attempt >= ACHIEVEMENT_RETRY_DELAYS_MS.length) return response
      await new Promise(resolve =>
        setTimeout(resolve, ACHIEVEMENT_RETRY_DELAYS_MS[attempt])
      )
    }
  }

  static async getPlayerAchievements(
    steamId: string,
    appId: number
  ): Promise<SteamAchievementSummary | null> {
    const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${this.getApiKey()}&steamid=${steamId}&appid=${appId}`
    const response = await this.fetchAchievementData(url)

    if (!response?.ok) return null

    const data = (await response.json()) as {
      playerstats?: {
        success?: boolean
        achievements?: {
          apiname: string
          achieved: number
          unlocktime?: number
        }[]
      }
    }

    const achievements = data.playerstats?.achievements
    if (!data.playerstats?.success || !achievements || achievements.length === 0) {
      return null
    }

    const achieved = achievements.filter(a => a.achieved === 1)

    return {
      achieved: achieved.length,
      total: achievements.length,
      achievedApiNames: achieved.map(a => a.apiname),
      unlockTimesByName: new Map(
        achieved.map(a => [a.apiname, a.unlocktime ?? 0])
      )
    }
  }

  static async getUnlockedAchievementTexts(
    steamId: string,
    appId: number
  ): Promise<Map<string, string> | null> {
    const url = `https://steamcommunity.com/profiles/${encodeURIComponent(steamId)}/stats/${appId}/?xml=1&l=english`
    const response = await this.fetchAchievementData(url)

    if (!response?.ok) return null

    const xml = await response.text()
    const texts = new Map<string, string>()
    const blocks = xml.matchAll(
      /<achievement closed="1">([\s\S]*?)<\/achievement>/g
    )
    for (const [, block] of blocks) {
      const field = (tag: string) =>
        new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]></${tag}>`).exec(
          block
        )?.[1] ?? ''
      const apiName = field('apiname').toLowerCase()
      if (!apiName) continue
      texts.set(apiName, `${field('name')} ${field('description')}`.trim())
    }

    return texts.size > 0 ? texts : null
  }

  static async getGlobalAchievementPercentages(
    appId: number
  ): Promise<Map<string, number> | null> {
    const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?key=${this.getApiKey()}&gameid=${appId}`
    const response = await this.fetchAchievementData(url)

    if (!response?.ok) return null

    const data = (await response.json()) as {
      achievementpercentages?: {
        achievements?: { name: string; percent: number }[]
      }
    }

    const achievements = data.achievementpercentages?.achievements
    if (!achievements || achievements.length === 0) return null

    return new Map(achievements.map(a => [a.name, a.percent]))
  }

  static async getAchievementSchema(
    appId: number
  ): Promise<Map<string, string> | null> {
    const url = `https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=${this.getApiKey()}&appid=${appId}&l=english`
    const response = await this.fetchAchievementData(url)

    if (!response?.ok) return null

    const data = (await response.json()) as {
      game?: {
        availableGameStats?: {
          achievements?: { name: string; description?: string }[]
        }
      }
    }

    const achievements = data.game?.availableGameStats?.achievements
    if (!achievements || achievements.length === 0) return null

    return new Map(achievements.map(a => [a.name, a.description ?? '']))
  }
}
