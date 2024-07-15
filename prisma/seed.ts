import { prisma } from '../src/database/db'

async function main() {
  const user = await prisma.user.upsert({
    where: {
      email: 'mathquente@gmail.com'
    },
    update: {},
    create: {
      email: 'mathquente@gmail.com',
      password: '123456'
    },
    select: {
      id: true
    }
  })

  const studio1 = await prisma.gameStudio.upsert({
    where: {
      studioName: 'FromSoftware'
    },
    update: {},
    create: {
      studioName: 'FromSoftware'
    },
    select: {
      id: true
    }
  })

  const studio2 = await prisma.gameStudio.upsert({
    where: {
      studioName: 'Rockstar North'
    },
    update: {},
    create: {
      studioName: 'Rockstar North'
    },
    select: {
      id: true
    }
  })

  const publisher1 = await prisma.publisher.upsert({
    where: {
      publisherName: 'Bandai Namco Entertainment'
    },
    update: {},
    create: {
      publisherName: 'Bandai Namco Entertainment'
    },
    select: {
      id: true
    }
  })

  const publisher2 = await prisma.publisher.upsert({
    where: {
      publisherName: 'Rockstar Games'
    },
    update: {},
    create: {
      publisherName: 'Rockstar Games'
    },
    select: {
      id: true
    }
  })

  const game1 = await prisma.game.upsert({
    where: {
      gameName: 'Elden Ring'
    },
    update: {},
    create: {
      gameName: 'Elden Ring',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/512953_IGDB-285x380.jpg',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'RPG' },
            create: { categoryName: 'RPG' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          {
            where: { platformName: 'PlayStation 5' },
            create: { platformName: 'PlayStation 5' }
          },
          {
            where: { platformName: 'PlayStation 4' },
            create: { platformName: 'PlayStation 4' }
          },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          },
          {
            where: { platformName: 'Xbox Series X|S' },
            create: { platformName: 'Xbox Series X|S' }
          },
          {
            where: { platformName: 'PC' },
            create: { platformName: 'PC' }
          }
        ]
      },
      gameStudioId: studio1.id,
      publisherId: publisher1.id
    },
    select: {
      id: true
    }
  })

  const game2 = await prisma.game.upsert({
    where: {
      gameName: 'Dark Souls III'
    },
    update: {},
    create: {
      gameName: 'Dark Souls III',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/490292_IGDB-285x380.jpg',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'RPG' },
            create: { categoryName: 'RPG' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          {
            where: { platformName: 'PlayStation 4' },
            create: { platformName: 'PlayStation 4' }
          },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          },

          {
            where: { platformName: 'PC' },
            create: { platformName: 'PC' }
          }
        ]
      },
      gameStudioId: studio1.id,
      publisherId: publisher1.id
    },
    select: {
      id: true
    }
  })

  const game3 = await prisma.game.upsert({
    where: {
      gameName: 'Grand Theft Auto V'
    },
    update: {},
    create: {
      gameName: 'Grand Theft Auto V',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/32982_IGDB-285x380.jpg',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          {
            where: { platformName: 'PlayStation 4' },
            create: { platformName: 'PlayStation 4' }
          },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          },
          {
            where: { platformName: 'PC' },
            create: { platformName: 'PC' }
          },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          },
          {
            where: { platformName: 'Xbox Series X|S' },
            create: { platformName: 'Xbox Series X|S' }
          },
          {
            where: { platformName: 'PlayStation 3' },
            create: { platformName: 'PlayStation 3' }
          },
          {
            where: { platformName: 'Xbox 360' },
            create: { platformName: 'Xbox 360' }
          }
        ]
      },
      gameStudioId: studio2.id,
      publisherId: publisher2.id
    },
    select: {
      id: true
    }
  })

  const gameDateReleaseOnPlataform = await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        gameId: game1.id,
        platformId: '8e5e4698-1e7d-454a-9141-f981929053cf'
      }
    },
    update: {},
    create: {
      dateRelease: '2022-02-25T03:00:00.000Z',
      gameId: game1.id,
      platformId: '8e5e4698-1e7d-454a-9141-f981929053cf'
    },
    select: {
      platforms: {
        select: {
          platformName: true
        }
      },
      dateRelease: true
    }
  })

  const statusFinished = await prisma.userGamesStatus.upsert({
    where: {
      id: 1
    },
    update: {},
    create: {
      status: 'finished'
    }
  })

  const statusPlaying = await prisma.userGamesStatus.upsert({
    where: {
      id: 2
    },
    update: {},
    create: {
      status: 'playing'
    }
  })

  const statusPaused = await prisma.userGamesStatus.upsert({
    where: {
      id: 2
    },
    update: {},
    create: {
      status: 'paused'
    }
  })

  console.log(
    user,
    studio1,
    studio2,
    game1,
    game2,
    game3,
    publisher1,
    publisher2,
    gameDateReleaseOnPlataform,
    statusFinished,
    statusPaused,
    statusPlaying
  )
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async e => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
