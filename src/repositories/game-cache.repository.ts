import { Prisma } from '@prisma/client'
import { prisma } from '../database/db'
import { GameCacheSortBy, GameCacheSortOrder } from '../types/game-cache'
import { GAME_STATUS } from '../utils/game-status'

const MIN_TOTAL_RATING_COUNT = 10
const MIN_HYPES = 5
const HIDDEN_STATUS_IDS = [GAME_STATUS.CANCELLED, GAME_STATUS.RUMORED]

export function catalogVisibilityWhere(): Prisma.GameCacheWhereInput {
  return {
    OR: [
      { gameStatus: null },
      { gameStatus: { notIn: HIDDEN_STATUS_IDS } },
      { gameStatus: GAME_STATUS.CANCELLED, releaseDate: { not: null } }
    ]
  }
}

export function catalogVisibilitySql() {
  return Prisma.sql`(gc.game_status IS NULL OR gc.game_status NOT IN (${Prisma.join(HIDDEN_STATUS_IDS)}) OR (gc.game_status = ${GAME_STATUS.CANCELLED} AND gc.release_date IS NOT NULL))`
}

export function normalizeSearchTerm(query: string | undefined) {
  return query?.trim().replace(/\s+/g, ' ') ?? ''
}

export function escapeLike(term: string) {
  return term.replace(/[\\%_]/g, '\\$&')
}

const FOLDED_NAME = Prisma.sql`unaccent(lower(gc.name))`

export function relevanceMatchSql(query: string) {
  return Prisma.sql`${FOLDED_NAME} LIKE unaccent(lower(${`%${escapeLike(query)}%`})) ESCAPE '\\'`
}

export function relevanceOrderSql(query: string) {
  const term = escapeLike(query)
  return Prisma.sql`CASE
      WHEN ${FOLDED_NAME} = unaccent(lower(${query})) THEN 0
      WHEN ${FOLDED_NAME} LIKE unaccent(lower(${`${term}%`})) ESCAPE '\\' THEN 1
      WHEN ${FOLDED_NAME} LIKE unaccent(lower(${`% ${term}%`})) ESCAPE '\\' THEN 2
      ELSE 3
    END,
    (gc.parent_game_id IS NOT NULL),
    gc.total_rating_count DESC NULLS LAST,
    gc.hypes DESC NULLS LAST,
    gc.name ASC,
    gc.igdb_id ASC`
}

export class GameCacheRepository {
  async findMany({
    limit = 20,
    pageIndex = 0,
    sortBy = 'release_date' as GameCacheSortBy,
    sortOrder = 'desc' as GameCacheSortOrder,
    query
  }: {
    limit?: number
    pageIndex?: number
    sortBy?: GameCacheSortBy
    sortOrder?: GameCacheSortOrder
    query?: string
  }) {
    const offset = pageIndex * limit

    if (sortBy === 'rating') {
      return this.findManyByRating({ limit, offset, sortOrder, query })
    }

    const searchTerm = normalizeSearchTerm(query)
    if (sortBy === 'relevance' && searchTerm) {
      return this.findManyByRelevance({ limit, offset, query: searchTerm })
    }

    const where: Prisma.GameCacheWhereInput = {
      AND: [
        {
          OR: [
            { totalRatingCount: { gte: MIN_TOTAL_RATING_COUNT } },
            { hypes: { gte: MIN_HYPES } }
          ]
        },
        catalogVisibilityWhere()
      ],
      ...(query ? { name: { contains: query, mode: 'insensitive' } } : {})
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

  private async findManyByRelevance({
    limit,
    offset,
    query
  }: {
    limit: number
    offset: number
    query: string
  }) {
    const where = Prisma.sql`WHERE (gc.total_rating_count >= ${MIN_TOTAL_RATING_COUNT} OR gc.hypes >= ${MIN_HYPES}) AND ${catalogVisibilitySql()} AND ${relevanceMatchSql(query)}`

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
               gc.category, gc.parent_game_id
        FROM games_cache gc
        ${where}
        ORDER BY ${relevanceOrderSql(query)}
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

  private async findManyByRating({
    limit,
    offset,
    sortOrder,
    query
  }: {
    limit: number
    offset: number
    sortOrder: GameCacheSortOrder
    query?: string
  }) {
    const direction = sortOrder === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`
    const nameFilter = query
      ? Prisma.sql`AND gc.name ILIKE ${`%${query}%`}`
      : Prisma.empty
    const where = Prisma.sql`WHERE (gc.total_rating_count >= ${MIN_TOTAL_RATING_COUNT} OR gc.hypes >= ${MIN_HYPES}) AND ${catalogVisibilitySql()} ${nameFilter}`

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
      gameModes?: number[]
      gameStatus?: number | null
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
        parentGameId: g.parentGameId ?? null,
        gameModes: g.gameModes ?? [],
        gameStatus: g.gameStatus ?? null
      })),
      skipDuplicates: true
    })
  }

  async findByIgdbId(igdbId: number) {
    return prisma.gameCache.findUnique({
      where: { igdbId },
      select: { igdbId: true }
    })
  }

  async findReleaseInfoByIgdbId(igdbId: number) {
    return prisma.gameCache.findUnique({
      where: { igdbId },
      select: { releaseDate: true, gameModes: true, name: true }
    })
  }

  async findEndlessInputByIgdbId(
    igdbId: number
  ): Promise<{ gameModes: number[]; name: string } | null> {
    return prisma.gameCache.findUnique({
      where: { igdbId },
      select: { gameModes: true, name: true }
    })
  }

  async findIgdbIdsAfter(afterId: number, limit: number): Promise<number[]> {
    const rows = await prisma.gameCache.findMany({
      where: { igdbId: { gt: afterId } },
      orderBy: { igdbId: 'asc' },
      take: limit,
      select: { igdbId: true }
    })
    return rows.map(r => r.igdbId)
  }

  async updateGameModes(
    updates: Array<{ igdbId: number; gameModes: number[] }>
  ) {
    if (updates.length === 0) return
    const rows = JSON.stringify(
      updates.map(u => ({ id: u.igdbId, modes: u.gameModes }))
    )
    await prisma.$executeRaw(Prisma.sql`
      UPDATE games_cache gc
      SET game_modes = ARRAY(SELECT jsonb_array_elements_text(v.modes)::int)
      FROM jsonb_to_recordset(${rows}::jsonb) AS v(id int, modes jsonb)
      WHERE gc.igdb_id = v.id
    `)
  }

  async updateGameStatuses(
    updates: Array<{ igdbId: number; gameStatus: number | null }>
  ) {
    if (updates.length === 0) return
    const rows = JSON.stringify(
      updates.map(u => ({ id: u.igdbId, status: u.gameStatus }))
    )
    await prisma.$executeRaw(Prisma.sql`
      UPDATE games_cache gc
      SET game_status = v.status
      FROM jsonb_to_recordset(${rows}::jsonb) AS v(id int, status int)
      WHERE gc.igdb_id = v.id
    `)
  }

  async findHiddenStatusIdsAfter(
    afterId: number,
    limit: number
  ): Promise<number[]> {
    const rows = await prisma.gameCache.findMany({
      where: { igdbId: { gt: afterId }, gameStatus: { in: HIDDEN_STATUS_IDS } },
      orderBy: { igdbId: 'asc' },
      take: limit,
      select: { igdbId: true }
    })
    return rows.map(r => r.igdbId)
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

  async updateTotalRatingCounts(
    updates: Array<{ igdbId: number; totalRatingCount: number }>
  ) {
    await prisma.$transaction(
      updates.map(u =>
        prisma.gameCache.update({
          where: { igdbId: u.igdbId },
          data: { totalRatingCount: u.totalRatingCount }
        })
      )
    )
  }

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
    updates: Array<{
      igdbId: number
      category: number
      parentGameId: number | null
    }>
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
