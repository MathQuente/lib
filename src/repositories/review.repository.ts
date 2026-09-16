import { Prisma } from '@prisma/client'
import { prisma } from '../database/db'
import { CommunityReviewRow } from '../types/review'

export class ReviewRepository {
  async findByUserGame(igdbId: number, userId: string) {
    return prisma.review.findUnique({
      where: { userId_igdbId: { userId, igdbId } }
    })
  }

  async findCommunityReviews({
    igdbId,
    skip,
    take
  }: {
    igdbId: number
    skip: number
    take: number
  }): Promise<CommunityReviewRow[]> {
    return prisma.$queryRaw<CommunityReviewRow[]>(Prisma.sql`
      SELECT
        rv.user_id                    AS "userId",
        u.user_name                   AS "userName",
        u.profile_picture             AS "profilePicture",
        r.value                       AS "rating",
        COALESCE(ugst.hours_played, 0)::float AS "hoursPlayed",
        COALESCE(ugst.completions, 0) AS "completions",
        rv.text                       AS "text",
        rv.created_at                 AS "createdAt"
      FROM reviews rv
      JOIN users u ON u.id = rv.user_id
      LEFT JOIN ratings r ON r.igdb_id = rv.igdb_id AND r.user_id = rv.user_id
      LEFT JOIN user_games ug ON ug.igdb_id = rv.igdb_id AND ug.user_id = rv.user_id
      LEFT JOIN user_game_stats ugst ON ugst.user_game_id = ug.id
      WHERE rv.igdb_id = ${igdbId}
      ORDER BY rv.created_at DESC
      LIMIT ${take} OFFSET ${skip}
    `)
  }

  async countCommunityReviews(igdbId: number): Promise<number> {
    const result = await prisma.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      SELECT COUNT(*) AS count
      FROM reviews rv
      WHERE rv.igdb_id = ${igdbId}
    `)

    return Number(result[0].count)
  }

  async upsert(userId: string, igdbId: number, text: string) {
    return prisma.review.upsert({
      where: { userId_igdbId: { userId, igdbId } },
      update: { text },
      create: { userId, igdbId, text }
    })
  }

  async delete(userId: string, igdbId: number) {
    return prisma.review.delete({
      where: { userId_igdbId: { userId, igdbId } }
    })
  }
}
