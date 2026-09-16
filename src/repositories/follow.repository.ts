import { prisma } from '../database/db'

const FOLLOW_SELECT = {
  id: true,
  userName: true,
  profilePicture: true
} as const

export class FollowRepository {
  async isFollowing(followerId: string, followingId: string) {
    const row = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } }
    })
    return !!row
  }

  async follow(followerId: string, followingId: string) {
    return prisma.follow.create({ data: { followerId, followingId } })
  }

  async unfollow(followerId: string, followingId: string) {
    await prisma.follow.deleteMany({ where: { followerId, followingId } })
  }

  async findFollowers(userId: string) {
    const rows = await prisma.follow.findMany({
      where: { followingId: userId },
      orderBy: { createdAt: 'desc' },
      select: { follower: { select: FOLLOW_SELECT } }
    })
    return rows.map(r => r.follower)
  }

  async findFollowing(userId: string) {
    const rows = await prisma.follow.findMany({
      where: { followerId: userId },
      orderBy: { createdAt: 'desc' },
      select: { following: { select: FOLLOW_SELECT } }
    })
    return rows.map(r => r.following)
  }

  async countFollowers(userId: string) {
    return prisma.follow.count({ where: { followingId: userId } })
  }

  async countFollowing(userId: string) {
    return prisma.follow.count({ where: { followerId: userId } })
  }
}
