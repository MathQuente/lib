import { Prisma } from '@prisma/client'
import { prisma } from '../database/db'

type SortBy = 'name' | 'release_date' | 'rating'
type SortOrder = 'asc' | 'desc'

export class GameCacheRepository {
  async findMany({
    limit = 20,
    pageIndex = 0,
    sortBy = 'release_date' as SortBy,
    sortOrder = 'desc' as SortOrder,
    query
  }: {
    limit?: number
    pageIndex?: number
    sortBy?: SortBy
    sortOrder?: SortOrder
    query?: string
  }) {
    const offset = pageIndex * limit
    const where: Prisma.GameCacheWhereInput = query
      ? { name: { contains: query, mode: 'insensitive' } }
      : {}

    if (sortBy === 'rating') {
      return this.findManyByRating({ limit, offset, sortOrder, query })
    }

    const orderBy: Prisma.GameCacheOrderByWithRelationInput =
      sortBy === 'name'
        ? { name: sortOrder }
        : { releaseDate: { sort: sortOrder, nulls: 'last' } }

    const [games, total] = await Promise.all([
      prisma.gameCache.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        select: {
          igdbId: true,
          name: true,
          coverUrl: true,
          summary: true,
          genres: true,
          platforms: true,
          releaseDate: true
        }
      }),
      prisma.gameCache.count({ where })
    ])

    return { games, total }
  }

  private async findManyByRating({
    limit,
    offset,
    sortOrder,
    query
  }: {
    limit: number
    offset: number
    sortOrder: SortOrder
    query?: string
  }) {
    const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`
    const nameFilter = query
      ? Prisma.sql`WHERE gc.name ILIKE ${`%${query}%`}`
      : Prisma.empty

    const [games, countResult] = await Promise.all([
      prisma.$queryRaw<
        Array<{
          igdb_id: number
          name: string
          cover_url: string | null
          summary: string | null
          genres: string[]
          platforms: string[]
          release_date: number | null
        }>
      >(Prisma.sql`
        SELECT gc.igdb_id, gc.name, gc.cover_url, gc.summary, gc.genres, gc.platforms, gc.release_date,
               AVG(r.value) as avg_rating
        FROM games_cache gc
        LEFT JOIN ratings r ON r.igdb_id = gc.igdb_id
        ${nameFilter}
        GROUP BY gc.igdb_id
        ORDER BY avg_rating ${direction} NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) FROM games_cache gc ${nameFilter}
      `)
    ])

    return {
      games: games.map(g => ({
        igdbId: g.igdb_id,
        name: g.name,
        coverUrl: g.cover_url,
        summary: g.summary,
        genres: g.genres,
        platforms: g.platforms,
        releaseDate: g.release_date
      })),
      total: Number(countResult[0].count)
    }
  }

  async upsertMany(
    games: Array<{
      igdbId: number
      name: string
      coverUrl: string | null
      summary?: string
      genres: string[]
      platforms: string[]
      releaseDate?: number
    }>
  ) {
    await prisma.gameCache.createMany({
      data: games.map(g => ({
        igdbId: g.igdbId,
        name: g.name,
        coverUrl: g.coverUrl,
        summary: g.summary ?? null,
        genres: g.genres,
        platforms: g.platforms,
        releaseDate: g.releaseDate ?? null
      })),
      skipDuplicates: true
    })
  }

  async getMaxIgdbId(): Promise<number> {
    const result = await prisma.gameCache.findFirst({
      orderBy: { igdbId: 'desc' },
      select: { igdbId: true }
    })
    return result?.igdbId ?? 0
  }

  async count(): Promise<number> {
    return prisma.gameCache.count()
  }
}
