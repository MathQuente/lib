import { prisma } from '../database/db'

export class PlatformRepository {
  async findByName(platformName: string) {
    // Search platform by your name
    return prisma.platform.findUnique({
      where: {
        platformName
      }
    })
  }

  async create(platformName: string) {
    // Create platform using Prisma
    return prisma.platform.create({
      data: {
        platformName
      },
      select: {
        id: true
      }
    })
  }

  async findById(platformId: string, { pageIndex = 0, limit = 14 } = {}) {
    // Search platform by your ID
    return prisma.platform.findUnique({
      where: {
        id: platformId
      },
      select: {
        id: true,
        platformName: true,
        games: {
          orderBy: [
            {
              gameName: 'asc'
            }
          ],
          skip: pageIndex * limit,
          take: limit,
          select: {
            id: true,
            gameName: true,
            gameBanner: true
          }
        },
        dlcs: {
          orderBy: [{ dlcName: 'asc' }],
          skip: pageIndex * limit,
          take: limit,
          select: {
            id: true,
            dlcName: true,
            dlcBanner: true
          }
        },
        _count: {
          select: {
            games: true,
            dlcs: true
          }
        }
      }
    })
  }

  async findAll({ pageIndex = 0, limit = 14 } = {}) {
    // Search all platforms
    return prisma.platform.findMany({
      orderBy: [{ platformName: 'asc' }],
      skip: pageIndex * limit,
      take: limit,
      select: {
        id: true,
        platformName: true,
        games: {
          orderBy: [{ gameName: 'asc' }],
          skip: pageIndex * limit,
          take: limit,
          select: {
            id: true,
            gameName: true,
            gameBanner: true
          }
        },
        dlcs: {
          orderBy: [{ dlcName: 'asc' }],
          skip: pageIndex * limit,
          take: limit,
          select: {
            id: true,
            dlcName: true,
            dlcBanner: true
          }
        },
        _count: {
          select: {
            games: true,
            dlcs: true
          }
        }
      }
    })
  }

  async update(platformId: string, platformName: string) {
    // update platformName by your ID
    return prisma.platform.update({
      where: {
        id: platformId
      },
      data: {
        platformName
      },
      select: {
        id: true,
        platformName: true
      }
    })
  }

  async delete(platformId: string) {
    // delete platform by your ID
    return prisma.platform.delete({
      where: {
        id: platformId
      },
      select: {
        id: true,
        platformName: true
      }
    })
  }
}
