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

  static async searchGames(query: string, limit = 10, pageIndex = 0): Promise<{ games: IGDBGame[]; total: number }> {
    const where = `search "${query}"`
    const [games, rawTotal] = await Promise.all([
      this.request<IGDBGame[]>(
        'games',
        `${where}; fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,rating,follows; limit ${limit}; offset ${pageIndex * limit};`
      ),
      this.countRequest('games', `${where};`)
    ])
    return { games, total: Math.min(rawTotal, 10000) }
  }

  static async getGameById(igdbId: number): Promise<IGDBGame | null> {
    const results = await this.request<IGDBGame[]>(
      'games',
      `where id = ${igdbId}; fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,rating,follows,similar_games,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; limit 1;`
    )
    return results[0] ?? null
  }

  static async getGamesByIds(ids: number[]): Promise<IGDBGame[]> {
    if (ids.length === 0) return []
    return this.request(
      'games',
      `where id = (${ids.join(',')}); fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date,category,rating,follows; limit ${Math.min(ids.length, 500)};`
    )
  }

  static async getFeaturedGames() {
    const now = Math.floor(Date.now() / 1000)

    const [mostRated, trending, recent, future] = await Promise.all([
      this.request<IGDBGame[]>(
        'games',
        `fields id,name,cover.url,rating,platforms.name; where rating != null & cover != null; sort rating desc; limit 6;`
      ),
      this.request<IGDBGame[]>(
        'games',
        `fields id,name,cover.url,rating,platforms.name,first_release_date; where first_release_date != null & cover != null; sort id desc; limit 6;`
      ),
      this.request<IGDBGame[]>(
        'games',
        `fields id,name,cover.url,rating,platforms.name,first_release_date; where first_release_date < ${now} & first_release_date != null & cover != null; sort first_release_date desc; limit 6;`
      ),
      this.request<IGDBGame[]>(
        'games',
        `fields id,name,cover.url,platforms.name,first_release_date; where first_release_date > ${now} & cover != null; sort first_release_date asc; limit 6;`
      )
    ])

    return { mostRated, trending, recent, future }
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
      `fields id,name,summary,cover.url,genres.name,platforms.name,first_release_date; where id > ${lastId} & cover != null & parent_game = null; sort id asc; limit ${limit};`
    )
  }

  static async getComingSoonGames(limit = 20): Promise<IGDBGame[]> {
    const now = Math.floor(Date.now() / 1000)
    return this.request(
      'games',
      `fields id,name,cover.url,platforms.name,first_release_date; where first_release_date > ${now} & parent_game = null & cover != null; sort first_release_date asc; limit ${limit};`
    )
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
      `where id = (${similarIds.slice(0, 6).join(',')}); fields id,name,cover.url,rating,platforms.name; limit 6;`
    )
  }
}
