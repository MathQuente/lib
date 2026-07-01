import { IGDBGame } from '../types/igdb'

export class IGDBService {
  private static accessToken: string | null = null
  private static tokenExpiresAt: number = 0

  private static async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken
    }

    const response = await fetch(
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

  private static async countRequest(endpoint: string, body: string): Promise<number> {
    const token = await this.getAccessToken()
    const response = await fetch(`https://api.igdb.com/v4/${endpoint}/count`, {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body
    })
    const data = await response.json() as { count?: number }
    return data.count ?? 0
  }

  private static async request<T>(endpoint: string, body: string): Promise<T> {
    const token = await this.getAccessToken()

    const response = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': process.env.IGDB_CLIENT_ID!,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'text/plain'
      },
      body
    })

    const data = await response.json()
    if (!Array.isArray(data)) {
      console.error('[IGDB] unexpected response', { status: response.status, data })
      return [] as T
    }
    if (data.length > 0 && 'title' in data[0]) {
      console.error('[IGDB] API error', { error: data[0] })
      return [] as T
    }
    return data as T
  }

  static formatCoverUrl(url: string | undefined): string | null {
    if (!url) return null
    return `https:${url.replace('t_thumb', 't_cover_big')}`
  }

  static readonly INT4_MAX = 2_147_483_647

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
      // -1 marks "IGDB has no category for this game" vs. a real category id (0-14).
      category: g.category ?? -1,
      parentGameId: g.parent_game ?? null
    }
  }

  // Minimum IGDB "hypes" (people who marked interest before release) to
  // consider an upcoming game notable enough to surface as "coming soon".
  static readonly MIN_HYPES = 5

  // Minimum IGDB "total_rating_count" (critic + user ratings) to consider an
  // already-released game notable enough to surface. Unlike hypes, this works
  // for classics released before IGDB's hype-tracking feature existed.
  // IGDB's "category" field (main_game/dlc/remaster/...) is too inconsistently
  // populated to filter on — plenty of legitimate DLCs and remasters (e.g.
  // Alan Wake Remastered) have no category set at all — so we rely on these
  // engagement numbers instead of category to separate real games from shovelware.
  static readonly MIN_TOTAL_RATING_COUNT = 10

  // Brazil has not observed daylight saving time since 2019, so a fixed UTC-3
  // offset reliably represents "today" for our users, regardless of server timezone.
  private static readonly RELEASE_CUTOFF_UTC_OFFSET_HOURS = 3

  /**
   * Epoch (seconds) for the start of tomorrow in the America/Fortaleza timezone.
   * Comparing against this cutoff (instead of the exact current instant) keeps
   * games releasing "today" out of "coming soon" regardless of what time it is.
   */
  static getReleaseCutoffEpoch(): number {
    const [year, month, day] = new Date()
      .toLocaleDateString('en-CA', { timeZone: 'America/Fortaleza' })
      .split('-')
      .map(Number)
    const tomorrowUTC = Date.UTC(year, month - 1, day + 1, this.RELEASE_CUTOFF_UTC_OFFSET_HOURS, 0, 0)
    return Math.floor(tomorrowUTC / 1000)
  }

  static async searchGames(query: string, limit = 10, pageIndex = 0): Promise<{ games: IGDBGame[]; total: number }> {
    const where = `search "${query}"`
    const [games, rawTotal] = await Promise.all([
      this.request<IGDBGame[]>(
        'games',
        `${where}; fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,parent_game,rating,follows; limit ${limit}; offset ${pageIndex * limit};`
      ),
      this.countRequest('games', `${where};`)
    ])
    return { games, total: Math.min(rawTotal, 10000) }
  }

  static async getGameById(igdbId: number): Promise<IGDBGame | null> {
    const results = await this.request<IGDBGame[]>(
      'games',
      `where id = ${igdbId}; fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,parent_game,rating,follows,similar_games,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`
    )
    return results[0] ?? null
  }

  // DLCs/expansions/remasters that point to this game via parent_game — fetched
  // live so it doesn't depend on the local cache backfill being up to date.
  static async getRelatedGames(igdbId: number): Promise<IGDBGame[]> {
    return this.request<IGDBGame[]>(
      'games',
      `where parent_game = ${igdbId}; fields id,name,cover.url,category,parent_game,first_release_date,rating; sort first_release_date asc; limit 50;`
    )
  }

  static async getGamesByIds(ids: number[]): Promise<IGDBGame[]> {
    if (ids.length === 0) return []
    return this.request(
      'games',
      `where id = (${ids.join(',')}); fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,parent_game,rating,follows; limit ${Math.min(ids.length, 500)};`
    )
  }

  static async getRecentlyReleasedGames(limit = 6): Promise<IGDBGame[]> {
    const cutoff = this.getReleaseCutoffEpoch()
    return this.request<IGDBGame[]>(
      'games',
      `fields id,name,cover.url,rating,platforms.name,first_release_date,category,parent_game; where first_release_date < ${cutoff} & first_release_date != null & cover != null & total_rating_count >= ${this.MIN_TOTAL_RATING_COUNT}; sort first_release_date desc; limit ${limit};`
    )
  }

  static async getPopularGames(
    limit = 20,
    pageIndex = 0,
    sortBy: 'name' | 'release_date' | 'rating' = 'release_date',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<{ games: IGDBGame[]; total: number }> {
    const now = Math.floor(Date.now() / 1000)
    let igdbSort: string
    if (sortBy === 'name') {
      igdbSort = `sort name ${sortOrder}`
    } else if (sortBy === 'release_date') {
      igdbSort = `sort first_release_date ${sortOrder}`
    } else {
      igdbSort = `sort first_release_date desc`
    }
    const where = `where first_release_date < ${now} & first_release_date != null & cover != null & parent_game = null`
    const [games, rawTotal] = await Promise.all([
      this.request<IGDBGame[]>(
        'games',
        `fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date; ${where}; ${igdbSort}; limit ${limit}; offset ${pageIndex * limit};`
      ),
      this.countRequest('games', `${where};`)
    ])
    return { games, total: Math.min(rawTotal, 10000) }
  }

  static async fetchForSync(lastId: number, limit: number): Promise<IGDBGame[]> {
    return this.request(
      'games',
      `fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,hypes,total_rating_count,category,parent_game; where id > ${lastId} & cover != null; sort id asc; limit ${limit};`
    )
  }

  /**
   * One-off backfill helper: earlier syncs excluded anything with a parent_game
   * (DLCs, expansions, remasters...). This re-scans an already-synced id range
   * for that previously-skipped content so it can be added to the cache.
   * Quality is filtered downstream via total_rating_count/hypes, not here.
   */
  static async fetchMissingReleasedContent(lastId: number, maxId: number, limit: number): Promise<IGDBGame[]> {
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

  static async getTotalRatingCountsByIds(ids: number[]): Promise<Map<number, number>> {
    if (ids.length === 0) return new Map()
    const results = await this.request<{ id: number; total_rating_count?: number }[]>(
      'games',
      `where id = (${ids.join(',')}); fields id,total_rating_count; limit ${Math.min(ids.length, 500)};`
    )
    return new Map(results.map(r => [r.id, r.total_rating_count ?? 0]))
  }

  static async getCategoryAndParentByIds(
    ids: number[]
  ): Promise<Map<number, { category: number; parentGameId: number | null }>> {
    if (ids.length === 0) return new Map()
    const results = await this.request<{ id: number; category?: number; parent_game?: number }[]>(
      'games',
      `where id = (${ids.join(',')}); fields id,category,parent_game; limit ${Math.min(ids.length, 500)};`
    )
    return new Map(
      results.map(r => [r.id, { category: r.category ?? -1, parentGameId: r.parent_game ?? null }])
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
