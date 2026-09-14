import { IGDBRequestError } from '../errors/igdb-request-error'
import { IGDBGame } from '../types/igdb'
import { fetchWithTimeout } from '../utils/fetch-with-timeout'

export class IGDBService {
  private static accessToken: string | null = null
  private static tokenExpiresAt: number = 0

  private static async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    const response = await fetchWithTimeout(
      `https://id.twitch.tv/oauth2/token?client_id=${process.env.IGDB_CLIENT_ID}&client_secret=${process.env.IGDB_CLIENT_SECRET}&grant_type=client_credentials`,
      { method: 'POST' }
    )

    const data = (await response.json()) as {
      access_token: string
      expires_in: number
    }

    this.accessToken = data.access_token
    this.tokenExpiresAt = Date.now() + data.expires_in * 1000 - 60_000

    return this.accessToken
  }

  private static async countRequest(
    endpoint: string,
    body: string
  ): Promise<number> {
    const token = await this.getAccessToken()
    const response = await fetchWithTimeout(`https://api.igdb.com/v4/${endpoint}/count`, {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body
    })
    const data = (await response.json()) as { count?: number }

    if (!response.ok || 'title' in data) {
      console.error('[IGDB] count request failed', { status: response.status, data })
      throw new IGDBRequestError('IGDB count request failed', data)
    }

    return data.count ?? 0
  }

  private static async request<T>(endpoint: string, body: string): Promise<T> {
    const token = await this.getAccessToken()

    const response = await fetchWithTimeout(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body
    })

    const data = await response.json()
    if (
      !response.ok ||
      !Array.isArray(data) ||
      (data.length > 0 && 'title' in data[0])
    ) {
      console.error('[IGDB] request failed', {
        status: response.status,
        data
      })
      throw new IGDBRequestError('[IGDB] request failed', data)
    }

    return data as T
  }

  static formatCoverUrl(url: string | undefined): string | null {
    if (!url) return null
    return `https:${url.replace('t_thumb', 't_cover_big')}`
  }

  static readonly INT4_MAX = 2_147_483_647

  static getParentGameId(g: IGDBGame): number | null {
    return typeof g.parent_game === 'object'
      ? (g.parent_game?.id ?? null)
      : (g.parent_game ?? null)
  }

  static toGameCacheInput(g: IGDBGame) {
    return {
      igdbId: g.id,
      name: g.name,
      coverUrl: this.formatCoverUrl(g.cover?.url),
      summary: g.summary,
      genres: g.genres?.map(x => x.name) ?? [],
      platforms: g.platforms?.map(x => x.name) ?? [],
      releaseDate:
        g.first_release_date && g.first_release_date <= this.INT4_MAX
          ? g.first_release_date
          : undefined,
      hypes: g.hypes ?? 0,
      totalRatingCount: g.total_rating_count ?? 0,
      category: g.category ?? -1,
      parentGameId: this.getParentGameId(g)
    }
  }

  static readonly MIN_HYPES = 5
  static readonly MIN_TOTAL_RATING_COUNT = 10
  private static readonly RELEASE_CUTOFF_UTC_OFFSET_HOURS = 3

  static getReleaseCutoffEpoch(): number {
    const [year, month, day] = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })
      .split('-')
      .map(Number)
    const tomorrowUTC = Date.UTC(
      year,
      month - 1,
      day + 1,
      this.RELEASE_CUTOFF_UTC_OFFSET_HOURS,
      0,
      0
    )
    return Math.floor(tomorrowUTC / 1000)
  }

  static async getGameById(igdbId: number): Promise<IGDBGame | null> {
    const results = await this.request<IGDBGame[]>(
      'games',
      `where id = ${igdbId}; fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,game_type,parent_game.id,parent_game.name,parent_game.cover.url,rating,follows,similar_games,involved_companies.company.name,involved_companies.developer,involved_companies.publisher,release_dates.date,release_dates.platform.name; limit 1;`
    )
    return results[0] ?? null
  }

  static async getRelatedGames(igdbId: number): Promise<IGDBGame[]> {
    const games = await this.request<IGDBGame[]>(
      'games',
      `where parent_game = ${igdbId} & game_type != (5,12); fields id,name,cover.url,category,game_type,parent_game,first_release_date,rating; sort first_release_date asc; limit 50;`
    )

    return games.filter(g => !/\bbundle\b/i.test(g.name))
  }

  static async getGamesByIds(ids: number[]): Promise<IGDBGame[]> {
    if (ids.length === 0) return []
    return this.request(
      'games',
      `where id = (${ids.join(',')}); fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,parent_game,rating,follows; limit ${Math.min(ids.length, 500)};`
    )
  }

  // external_games.category is deprecated (always empty). The current
  // field is external_game_source, a reference into external_game_sources
  // — id 1 there is "Steam" (confirmed by querying that endpoint directly).
  private static readonly STEAM_EXTERNAL_GAME_SOURCE = 1
  private static readonly EXTERNAL_GAMES_BATCH_SIZE = 500

  // `external_games` is a reverse multi-relation on `games` — it can't be
  // filtered via `where external_games.uid = (...)` on the `games`
  // endpoint. IGDB requires querying the `external_games` endpoint
  // directly for the uid->game id mapping, then fetching those games.
  static async getGamesBySteamAppIds(
    appIds: number[]
  ): Promise<{ appId: number; game: IGDBGame }[]> {
    if (appIds.length === 0) return []

    const chunks: number[][] = []
    for (let i = 0; i < appIds.length; i += this.EXTERNAL_GAMES_BATCH_SIZE) {
      chunks.push(appIds.slice(i, i + this.EXTERNAL_GAMES_BATCH_SIZE))
    }

    const externalGamesResults = await Promise.all(
      chunks.map(chunk =>
        this.request<{ uid: string; game: number }[]>(
          'external_games',
          `where uid = (${chunk.map(id => `"${id}"`).join(',')}) & external_game_source = ${this.STEAM_EXTERNAL_GAME_SOURCE}; fields uid,game; limit ${chunk.length};`
        )
      )
    )

    const appIdToIgdbId = new Map<number, number>()
    for (const row of externalGamesResults.flat()) {
      const appId = Number(row.uid)
      if (!appIdToIgdbId.has(appId)) appIdToIgdbId.set(appId, row.game)
    }

    const igdbIds = [...new Set(appIdToIgdbId.values())]
    const igdbIdChunks: number[][] = []
    for (let i = 0; i < igdbIds.length; i += this.EXTERNAL_GAMES_BATCH_SIZE) {
      igdbIdChunks.push(igdbIds.slice(i, i + this.EXTERNAL_GAMES_BATCH_SIZE))
    }
    const games = (
      await Promise.all(igdbIdChunks.map(chunk => this.getGamesByIds(chunk)))
    ).flat()
    const gamesById = new Map(games.map(g => [g.id, g]))

    const results: { appId: number; game: IGDBGame }[] = []
    for (const [appId, igdbId] of appIdToIgdbId) {
      const game = gamesById.get(igdbId)
      if (game) results.push({ appId, game })
    }

    return results
  }

  static async getRecentlyReleasedGames(limit = 6): Promise<IGDBGame[]> {
    const cutoff = this.getReleaseCutoffEpoch()
    return this.request<IGDBGame[]>(
      'games',
      `fields id,name,cover.url,rating,platforms.name,first_release_date,category,parent_game; where first_release_date < ${cutoff} & first_release_date != null & cover != null & total_rating_count >= ${this.MIN_TOTAL_RATING_COUNT}; sort first_release_date desc; limit ${limit};`
    )
  }

  static async fetchForSync(
    lastId: number,
    limit: number
  ): Promise<IGDBGame[]> {
    return this.request(
      'games',
      `fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,hypes,total_rating_count,category,parent_game; where id > ${lastId} & cover != null; sort id asc; limit ${limit};`
    )
  }

  static async fetchMissingReleasedContent(
    lastId: number,
    maxId: number,
    limit: number
  ): Promise<IGDBGame[]> {
    return this.request(
      'games',
      `fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,hypes,total_rating_count,category,parent_game; where id > ${lastId} & id <= ${maxId} & cover != null & parent_game != null; sort id asc; limit ${limit};`
    )
  }

  static async getHypesByIds(ids: number[]): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map()
    const results = await this.request<{ id: number; hypes?: number }[]>(
      'games',
      `where id = (${ids.join(',')}); fields id,hypes; limit ${Math.min(ids.length, 500)};`
    )
    return new Map(results.map(r => [r.id, r.hypes ?? 0]))
  }

  static async getTotalRatingCountsByIds(
    ids: number[]
  ): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map()
    const results = await this.request<
      { id: number; total_rating_count?: number }[]
    >(
      'games',
      `where id = (${ids.join(',')}); fields id,total_rating_count; limit ${Math.min(ids.length, 500)};`
    )
    return new Map(results.map(r => [r.id, r.total_rating_count ?? 0]))
  }

  static async getCategoryAndParentByIds(
    ids: number[]
  ): Promise<Map<number, { category: number; parentGameId: number | null }>> {
    if (ids.length === 0) return new Map()
    const results = await this.request<
      { id: number; category?: number; parent_game?: number }[]
    >(
      'games',
      `where id = (${ids.join(',')}); fields id,category,parent_game; limit ${Math.min(ids.length, 500)};`
    )
    return new Map(
      results.map(r => [
        r.id,
        { category: r.category ?? -1, parentGameId: r.parent_game ?? null }
      ])
    )
  }

  static async getComingSoonGames(
    limit = 20,
    pageIndex = 0
  ): Promise<{ games: IGDBGame[]; total: number }> {
    const cutoff = this.getReleaseCutoffEpoch()
    const where = `where first_release_date >= ${cutoff} & cover != null & hypes >= ${this.MIN_HYPES}`
    const [games, rawTotal] = await Promise.all([
      this.request<IGDBGame[]>(
        'games',
        `fields id,name,cover.url,platforms.name,first_release_date,category,parent_game; ${where}; sort first_release_date asc; limit ${limit}; offset ${pageIndex * limit};`
      ),
      this.countRequest('games', `${where};`)
    ])
    return { games, total: Math.min(rawTotal, 10000) }
  }

  static async getSimilarGames(igdbId: number): Promise<IGDBGame[]> {
    const results = await this.request<IGDBGame[]>(
      'games',
      `where id = ${igdbId}; fields similar_games; limit 1;`
    )

    const similarIds = results[0]?.similar_games
    if (!similarIds || similarIds.length === 0) return []

    return this.request(
      'games',
      `where id = (${similarIds.slice(0, 6).join(',')}); fields id,name,cover.url,rating,platforms.name,category,parent_game; limit 6;`
    )
  }
}
