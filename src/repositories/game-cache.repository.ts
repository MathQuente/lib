import { Prisma } from '@prisma/client'
import { prisma } from '../database/db'

type SortBy = 'name' | 'release_date' | 'rating'
type SortOrder = 'asc' | 'desc'

// A cached game is notable enough to list/search if it clears either bar:
// enough post-release ratings (covers classics, which rarely have hype), or
// enough pre-release hype (covers unreleased/announced games with no ratings yet).
const MIN_TOTAL_RATING_COUNT = 10
const MIN_HYPES = 5

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
    const where: Prisma.GameCacheWhereInput = {
      OR: [{ totalRatingCount: { gte: MIN_TOTAL_RATING_COUNT } }, { hypes: { gte: MIN_HYPES } }],
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {})
    }

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
          releaseDate: true,
          category: true,
          parentGameId: true
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
    const nameFilter = query ? Prisma.sql`AND gc.name ILIKE ${`%${query}%`}` : Prisma.empty
    const where = Prisma.sql`WHERE (gc.total_rating_count >= ${MIN_TOTAL_RATING_COUNT} OR gc.hypes >= ${MIN_HYPES}) ${nameFilter}`

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
          category: number | null
          parent_game_id: number | null
        }>
      >(Prisma.sql`
        SELECT gc.igdb_id, gc.name, gc.cover_url, gc.summary, gc.genres, gc.platforms, gc.release_date,
               gc.category, gc.parent_game_id,
               AVG(r.value) as avg_rating
        FROM games_cache gc
        LEFT JOIN ratings r ON r.igdb_id = gc.igdb_id
        ${where}
        GROUP BY gc.igdb_id
        ORDER BY avg_rating ${direction} NULLS LAST
        LIMIT ${limit} OFFSET ${offset}
      `),
      prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
        SELECT COUNT(*) FROM games_cache gc ${where}
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
        releaseDate: g.release_date,
        category: g.category,
        parentGameId: g.parent_game_id
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
      hypes?: number
      totalRatingCount?: number
      category?: number
      parentGameId?: number | null
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
        releaseDate: g.releaseDate ?? null,
        hypes: g.hypes ?? 0,
        totalRatingCount: g.totalRatingCount ?? 0,
        category: g.category ?? -1,
        parentGameId: g.parentGameId ?? null
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

  async findManyMissingHypes(limit: number): Promise<number[]> {
    const rows = await prisma.gameCache.findMany({
      where: { hypes: null },
      orderBy: { igdbId: 'asc' },
      take: limit,
      select: { igdbId: true }
    })
    return rows.map(r => r.igdbId)
  }

  async updateHypes(updates: Array<{ igdbId: number; hypes: number }>) {
    await prisma.$transaction(
      updates.map(u =>
        prisma.gameCache.update({
          where: { igdbId: u.igdbId },
          data: { hypes: u.hypes }
        })
      )
    )
  }

  async findManyMissingTotalRatingCount(limit: number): Promise<number[]> {
    const rows = await prisma.gameCache.findMany({
      where: { totalRatingCount: null },
      orderBy: { igdbId: 'asc' },
      take: limit,
      select: { igdbId: true }
    })
    return rows.map(r => r.igdbId)
  }

  async updateTotalRatingCounts(updates: Array<{ igdbId: number; totalRatingCount: number }>) {
    await prisma.$transaction(
      updates.map(u =>
        prisma.gameCache.update({
          where: { igdbId: u.igdbId },
          data: { totalRatingCount: u.totalRatingCount }
        })
      )
    )
  }

  // `category` is always written (real id or the -1 "unknown" sentinel), so
  // `category IS NULL` reliably means "not backfilled yet" and only ever
  // matches once per row, even though category is legitimately absent for many games.
  async findManyMissingCategoryOrParent(limit: number): Promise<number[]> {
    const rows = await prisma.gameCache.findMany({
      where: { category: null },
      orderBy: { igdbId: 'asc' },
      take: limit,
      select: { igdbId: true }
    })
    return rows.map(r => r.igdbId)
  }

  async updateCategoryAndParent(
    updates: Array<{ igdbId: number; category: number; parentGameId: number | null }>
  ) {
    await prisma.$transaction(
      updates.map(u =>
        prisma.gameCache.update({
          where: { igdbId: u.igdbId },
          data: { category: u.category, parentGameId: u.parentGameId }
        })
      )
    )
  }
}
