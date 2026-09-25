import { fetchWithTimeout } from '../utils/fetch-with-timeout'

export interface SteamOwnedGame {
  appid: number
  name: string
  playtime_forever: number
  rtime_last_played?: number
}

export interface SteamAchievementSummary {
  achieved: number
  total: number
  achievedApiNames: string[]
  unlockTimesByName: Map<string, number>
}

export class SteamApiService {
  private static getApiKey(): string {
    const key = process.env.STEAM_API_KEY
    if (!key) {
      throw new Error('STEAM_API_KEY environment variable is required')
    }
    return key
  }

  static parseProfileInput(input: string): {
    steamId64?: string
    vanity?: string
  } {
    const trimmed = input.trim()

    if (/^\d{17}$/.test(trimmed)) {
      return { steamId64: trimmed }
    }

    const profileMatch = trimmed.match(
      /steamcommunity\.com\/profiles\/(\d{17})/i
    )
    if (profileMatch) return { steamId64: profileMatch[1] }

    const vanityMatch = trimmed.match(/steamcommunity\.com\/id\/([^/?#]+)/i)
    if (vanityMatch) return { vanity: vanityMatch[1] }

    return { vanity: trimmed }
  }

  static async resolveVanityUrl(vanityName: string): Promise<string | null> {
    const url = `https://api.steampowered.com/ISteamUser/ResolveVanityURL/v1/?key=${this.getApiKey()}&vanityurl=${encodeURIComponent(vanityName)}`
    const response = await fetchWithTimeout(url)
    const data = (await response.json()) as {
      response: { success: number; steamid?: string }
    }

    if (data.response.success !== 1 || !data.response.steamid) return null
    return data.response.steamid
  }

  static async getOwnedGames(
    steamId: string
  ): Promise<SteamOwnedGame[] | null> {
    const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${this.getApiKey()}&steamid=${steamId}&include_appinfo=1&format=json`
    const response = await fetchWithTimeout(url)

    if (!response.ok) return null

    const data = (await response.json()) as {
      response: { game_count?: number; games?: SteamOwnedGame[] }
    }

    // A private profile (or bad SteamID) returns an empty `response` object
    // with no `games` key at all — that's the only signal Valve gives us.
    if (!data.response.games) return null

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

    // Same shape-based signal as GetOwnedGames: a missing `items` key means
    // the profile/wishlist couldn't be read; an empty array is a real,
    // legitimately empty wishlist.
    if (!data.response?.items) return null

    return data.response.items
  }

  static async getPlayerAchievements(
    steamId: string,
    appId: number
  ): Promise<SteamAchievementSummary | null> {
    const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?key=${this.getApiKey()}&steamid=${steamId}&appid=${appId}`
    const response = await fetchWithTimeout(url)

    if (!response.ok) return null

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

    // `success: false` covers games with no achievement schema at all
    // (most multiplayer-only titles) — nothing to signal off of there.
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

  static async getGlobalAchievementPercentages(
    appId: number
  ): Promise<Map<string, number> | null> {
    const url = `https://api.steampowered.com/ISteamUserStats/GetGlobalAchievementPercentagesForApp/v2/?key=${this.getApiKey()}&gameid=${appId}`
    const response = await fetchWithTimeout(url)

    if (!response.ok) return null

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
    const response = await fetchWithTimeout(url)

    if (!response.ok) return null

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
