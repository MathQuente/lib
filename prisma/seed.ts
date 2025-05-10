import { prisma } from '../src/database/db'
import bcrypt from 'bcrypt'

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10)
  const user = await prisma.user.upsert({
    where: { email: 'test@gmail.com' },
    update: {
      // aqui você poderia atualizar campos, mas pode deixar vazio se não quiser alterar
    },
    create: {
      email: 'test@gmail.com',
      password: passwordHash
    }
  })

  const eldenRing = await prisma.game.upsert({
    where: { gameName: 'Elden Ring' },
    update: {},
    create: {
      gameName: 'Elden Ring',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/512953_IGDB-285x380.jpg',
      summary: 'asndjiwnd',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'FromSoftware' },
          create: { studioName: 'FromSoftware' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'FromSoftware' },
            create: { publisherName: 'FromSoftware' }
          },
          {
            where: { publisherName: 'Bandai' },
            create: { publisherName: 'Bandai' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } }
        ]
      }
    }
  })

  // The Witcher 3: Wild Hunt
  const witcher3 = await prisma.game.upsert({
    where: { gameName: 'The Witcher 3: Wild Hunt' },
    update: {},
    create: {
      gameName: 'The Witcher 3: Wild Hunt',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/115977_IGDB-285x380.jpg',
      summary:
        'Um RPG de mundo aberto com uma história envolvente. Jogue como Geralt de Rivia, um caçador de monstros procurando por sua filha adotiva.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'CD Projekt Red' },
          create: { studioName: 'CD Projekt Red' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'CD Projekt' },
            create: { publisherName: 'CD Projekt' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } },
          {
            where: { platformName: 'Xbox Series X/S' },
            create: { platformName: 'Xbox Series X/S' }
          },
          {
            where: { platformName: 'Nintendo Switch' },
            create: { platformName: 'Nintendo Switch' }
          }
        ]
      }
    }
  })

  // Red Dead Redemption 2
  const rdr2 = await prisma.game.upsert({
    where: { gameName: 'Red Dead Redemption 2' },
    update: {},
    create: {
      gameName: 'Red Dead Redemption 2',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/493959_IGDB-285x380.jpg',
      summary:
        'Uma épica história de foras da lei no velho oeste americano. Acompanhe Arthur Morgan e a gangue Van der Linde em uma aventura através da América em transformação.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Rockstar Games' },
          create: { studioName: 'Rockstar Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Rockstar Games' },
            create: { publisherName: 'Rockstar Games' }
          },
          {
            where: { publisherName: 'Take-Two Interactive' },
            create: { publisherName: 'Take-Two Interactive' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS4' }, create: { platformName: 'PS4' } },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          }
        ]
      }
    }
  })

  // Cyberpunk 2077
  const cyberpunk = await prisma.game.upsert({
    where: { gameName: 'Cyberpunk 2077' },
    update: {},
    create: {
      gameName: 'Cyberpunk 2077',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/65876_IGDB-285x380.jpg',
      summary:
        'Um RPG de ação em primeira pessoa ambientado em Night City, uma megalópole perigosa obcecada por poder, glamour e modificações corporais.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          },
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'CD Projekt Red' },
          create: { studioName: 'CD Projekt Red' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'CD Projekt' },
            create: { publisherName: 'CD Projekt' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } },
          {
            where: { platformName: 'Xbox Series X/S' },
            create: { platformName: 'Xbox Series X/S' }
          }
        ]
      }
    }
  })

  // God of War
  const godOfWar = await prisma.game.upsert({
    where: { gameName: 'God of War' },
    update: {},
    create: {
      gameName: 'God of War',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/6369_IGDB-285x380.jpg',
      summary:
        'Muitos anos após vingar-se dos deuses do Olimpo, Kratos agora vive como um mortal no reino dos deuses nórdicos. É nesse mundo hostil que ele deve lutar para sobreviver e ensinar seu filho a fazer o mesmo.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Santa Monica Studio' },
          create: { studioName: 'Santa Monica Studio' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Sony Interactive Entertainment' },
            create: { publisherName: 'Sony Interactive Entertainment' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS4' }, create: { platformName: 'PS4' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } }
        ]
      }
    }
  })

  // Hades
  const hades = await prisma.game.upsert({
    where: { gameName: 'Hades' },
    update: {},
    create: {
      gameName: 'Hades',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/510590_IGDB-285x380.jpg',
      summary:
        'Um roguelike de ação onde você combate seu caminho para fora do Submundo como o imortal Príncipe do Submundo, desafiando o deus dos mortos enquanto você se aproxima cada vez mais do Monte Olimpo.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Roguelike' },
            create: { categoryName: 'Roguelike' }
          },
          {
            where: { categoryName: 'Indie' },
            create: { categoryName: 'Indie' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Supergiant Games' },
          create: { studioName: 'Supergiant Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Supergiant Games' },
            create: { publisherName: 'Supergiant Games' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } },
          {
            where: { platformName: 'Xbox Series X/S' },
            create: { platformName: 'Xbox Series X/S' }
          },
          {
            where: { platformName: 'Nintendo Switch' },
            create: { platformName: 'Nintendo Switch' }
          }
        ]
      }
    }
  })

  // Horizon Forbidden West
  const horizonFW = await prisma.game.upsert({
    where: { gameName: 'Horizon Forbidden West' },
    update: {},
    create: {
      gameName: 'Horizon Forbidden West',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/518017_IGDB-285x380.jpg',
      summary:
        'Junte-se a Aloy enquanto ela enfrenta tempestades terríveis e novas máquinas perigosas para confrontar uma nova ameaça à vida na Terra.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          },
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Guerrilla Games' },
          create: { studioName: 'Guerrilla Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Sony Interactive Entertainment' },
            create: { publisherName: 'Sony Interactive Entertainment' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PS4' }, create: { platformName: 'PS4' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } }
        ]
      }
    }
  })

  // Final Fantasy VII Remake
  const ff7Remake = await prisma.game.upsert({
    where: { gameName: 'Final Fantasy VII Remake' },
    update: {},
    create: {
      gameName: 'Final Fantasy VII Remake',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/490292_IGDB-285x380.jpg',
      summary:
        'Uma reimaginação do clássico JRPG que segue Cloud Strife, um ex-SOLDIER que se junta a um grupo ecoterrorista para impedir que a corporação Shinra destrua o planeta.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          { where: { categoryName: 'JRPG' }, create: { categoryName: 'JRPG' } },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Square Enix' },
          create: { studioName: 'Square Enix' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Square Enix' },
            create: { publisherName: 'Square Enix' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS4' }, create: { platformName: 'PS4' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } }
        ]
      }
    }
  })

  // Baldur's Gate 3
  const baldursGate3 = await prisma.game.upsert({
    where: { gameName: "Baldur's Gate 3" },
    update: {},
    create: {
      gameName: "Baldur's Gate 3",
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/1229882460_IGDB-285x380.jpg',
      summary:
        'Um RPG ambientado no mundo de Dungeons & Dragons, onde você comanda um grupo de aventureiros em uma história épica de amizade e traição, sacrifício e sobrevivência.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Turn-Based' },
            create: { categoryName: 'Turn-Based' }
          },
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Larian Studios' },
          create: { studioName: 'Larian Studios' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Larian Studios' },
            create: { publisherName: 'Larian Studios' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS5' }, create: { platformName: 'PS5' } },
          {
            where: { platformName: 'Xbox Series X/S' },
            create: { platformName: 'Xbox Series X/S' }
          },
          { where: { platformName: 'Mac' }, create: { platformName: 'Mac' } }
        ]
      }
    }
  })

  // Hollow Knight
  const hollowKnight = await prisma.game.upsert({
    where: { gameName: 'Hollow Knight' },
    update: {},
    create: {
      gameName: 'Hollow Knight',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/490147_IGDB-285x380.jpg',
      summary:
        'Um jogo de ação e aventura 2D onde você explora o vasto reino interligado de Hallownest, cheio de insetos e heróis. Descubra novas habilidades e talentos em seu caminho.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Metroidvania' },
            create: { categoryName: 'Metroidvania' }
          },
          {
            where: { categoryName: 'Indie' },
            create: { categoryName: 'Indie' }
          },
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
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Team Cherry' },
          create: { studioName: 'Team Cherry' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Team Cherry' },
            create: { publisherName: 'Team Cherry' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS4' }, create: { platformName: 'PS4' } },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          },
          {
            where: { platformName: 'Nintendo Switch' },
            create: { platformName: 'Nintendo Switch' }
          }
        ]
      }
    }
  })

  // Sekiro: Shadows Die Twice
  const sekiro = await prisma.game.upsert({
    where: { gameName: 'Sekiro: Shadows Die Twice' },
    update: {},
    create: {
      gameName: 'Sekiro: Shadows Die Twice',
      gameBanner:
        'https://static-cdn.jtvnw.net/ttv-boxart/506415_IGDB-285x380.jpg',
      summary:
        'Uma aventura de ação ambientada no Japão feudal do período Sengoku, onde você controla um shinobi ferido e desonrado que busca vingança contra o clã samurai que o atacou.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
          {
            where: { categoryName: 'Souls-like' },
            create: { categoryName: 'Souls-like' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'FromSoftware' },
          create: { studioName: 'FromSoftware' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Activision' },
            create: { publisherName: 'Activision' }
          },
          {
            where: { publisherName: 'FromSoftware' },
            create: { publisherName: 'FromSoftware' }
          }
        ]
      },
      platforms: {
        connectOrCreate: [
          { where: { platformName: 'PC' }, create: { platformName: 'PC' } },
          { where: { platformName: 'PS4' }, create: { platformName: 'PS4' } },
          {
            where: { platformName: 'Xbox One' },
            create: { platformName: 'Xbox One' }
          }
        ]
      }
    }
  })

  const pcPlatform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'PC' }
  })
  const ps4Platform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'PS4' }
  })
  const ps5Platform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'PS5' }
  })
  const xboxOnePlatform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'Xbox One' }
  })
  const xboxSeriesPlatform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'Xbox Series X/S' }
  })
  const switchPlatform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'Nintendo Switch' }
  })
  const macPlatform = await prisma.platform.findUniqueOrThrow({
    where: { platformName: 'Mac' }
  })

  // Lançamentos do Elden Ring
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id!,
        gameId: eldenRing.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-25'),
      gameId: eldenRing.id,
      platformId: pcPlatform.id!
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: eldenRing.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-25'),
      gameId: eldenRing.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: eldenRing.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-25'),
      gameId: eldenRing.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Lançamentos do The Witcher 3
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: witcher3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-05-19'),
      gameId: witcher3.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: witcher3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-05-19'),
      gameId: witcher3.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: witcher3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-05-19'),
      gameId: witcher3.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: witcher3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-15'),
      gameId: witcher3.id,
      platformId: switchPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: witcher3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-12-14'),
      gameId: witcher3.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: witcher3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-12-14'),
      gameId: witcher3.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Lançamentos do Red Dead Redemption 2
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: rdr2.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-10-26'),
      gameId: rdr2.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: rdr2.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-10-26'),
      gameId: rdr2.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: rdr2.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-11-05'),
      gameId: rdr2.id,
      platformId: pcPlatform.id
    }
  })

  // Lançamentos do Cyberpunk 2077
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: cyberpunk.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-12-10'),
      gameId: cyberpunk.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: cyberpunk.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-12-10'),
      gameId: cyberpunk.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: cyberpunk.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-12-10'),
      gameId: cyberpunk.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: cyberpunk.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-15'),
      gameId: cyberpunk.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: cyberpunk.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-15'),
      gameId: cyberpunk.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Lançamentos do God of War
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: godOfWar.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-04-20'),
      gameId: godOfWar.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: godOfWar.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-01-14'),
      gameId: godOfWar.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: godOfWar.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-11-02'),
      gameId: godOfWar.id,
      platformId: ps5Platform.id
    }
  })

  // Lançamentos do Hades
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-09-17'),
      gameId: hades.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-09-17'),
      gameId: hades.id,
      platformId: switchPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-08-13'),
      gameId: hades.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-08-13'),
      gameId: hades.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-08-13'),
      gameId: hades.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-08-13'),
      gameId: hades.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Lançamentos do Horizon Forbidden West
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: horizonFW.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-18'),
      gameId: horizonFW.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: horizonFW.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-18'),
      gameId: horizonFW.id,
      platformId: ps5Platform.id
    }
  })

  // Lançamentos do Final Fantasy VII Remake
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: ff7Remake.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-04-10'),
      gameId: ff7Remake.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: ff7Remake.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-06-10'),
      gameId: ff7Remake.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: ff7Remake.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-12-16'),
      gameId: ff7Remake.id,
      platformId: pcPlatform.id
    }
  })

  // Lançamentos do Baldur's Gate 3
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: baldursGate3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-08-03'),
      gameId: baldursGate3.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: macPlatform.id,
        gameId: baldursGate3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-08-03'),
      gameId: baldursGate3.id,
      platformId: macPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: baldursGate3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-09-06'),
      gameId: baldursGate3.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: baldursGate3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-12-07'),
      gameId: baldursGate3.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Lançamentos do Hollow Knight
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: hollowKnight.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-02-24'),
      gameId: hollowKnight.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: macPlatform.id,
        gameId: hollowKnight.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-02-24'),
      gameId: hollowKnight.id,
      platformId: macPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: hollowKnight.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-04-11'),
      gameId: hollowKnight.id,
      platformId: switchPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: hollowKnight.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-09-25'),
      gameId: hollowKnight.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: hollowKnight.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-09-25'),
      gameId: hollowKnight.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Lançamentos do Sekiro: Shadows Die Twice
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: sekiro.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-03-22'),
      gameId: sekiro.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: sekiro.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-03-22'),
      gameId: sekiro.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: sekiro.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-03-22'),
      gameId: sekiro.id,
      platformId: xboxOnePlatform.id
    }
  })

  const initialStatuses = await prisma.userGamesStatus.createMany({
    skipDuplicates: true,
    data: [
      { id: 1, status: 'PLAYED' },
      { id: 2, status: 'PLAYING' },
      { id: 3, status: 'REPLAYING' },
      { id: 4, status: 'BACKLOG' },
      { id: 5, status: 'WISHLIST' }
    ]
  })

  console.log(user, eldenRing, initialStatuses)
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
