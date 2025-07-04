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

  const platforms = [
    'PC',
    'PS4',
    'PS5',
    'Xbox One',
    'Xbox Series X/S',
    'Nintendo Switch',
    'Mac',
    'Mobile',
    'Wii U'
  ]

  for (const platformName of platforms) {
    await prisma.platform.upsert({
      where: { platformName },
      update: {},
      create: { platformName }
    })
  }

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

  const eldenRing = await prisma.game.upsert({
    where: { gameName: 'Elden Ring' },
    update: {},
    create: {
      gameName: 'Elden Ring',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1245620/library_600x900_2x.jpg?t=1744748041',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/292030/fe26986a2bd1601004ef0e4e1dfadd02948e3897/library_600x900_2x.jpg',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Xbox One' },
          { platformName: 'PS4' },
          { platformName: 'Nintendo Switch' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1174180/library_600x900_2x.jpg',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1091500/fc7064f4a8ee2960eb51f5872d7990d771f26d2e/library_600x900_2x.jpg?t=1746519355',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1593500/library_600x900_2x.jpg',
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
        connect: [{ platformName: 'PC' }, { platformName: 'PS4' }]
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1145360/library_600x900_2x.jpg',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Nintendo Switch' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1151640/library_600x900_2x.jpg',
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
        connect: [{ platformName: 'PC' }, { platformName: 'PS4' }]
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1462040/library_600x900_2x.jpg',
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
        connect: [{ platformName: 'PC' }, { platformName: 'PS4' }]
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1086940/library_600x900_2x.jpg?t=1747226395',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/367520/library_600x900_2x.jpg?t=1695270428',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' },
          { platformName: 'Nintendo Switch' }
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
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/814380/library_600x900_2x.jpg?t=1726158438',
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  // Dark Souls III
  const darkSouls3 = await prisma.game.upsert({
    where: { gameName: 'Dark Souls III' },
    update: {},
    create: {
      gameName: 'Dark Souls III',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/374320/library_600x900_2x.jpg?t=1733509027',
      summary:
        'O último capítulo da aclamada série Souls, apresentando combate desafiador e um mundo interconectado cheio de segredos.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  // DLCs para Dark Souls III
  const ashesOfAriandel = await prisma.game.upsert({
    where: { gameName: 'Dark Souls III: Ashes of Ariandel' },
    update: {},
    create: {
      gameName: 'Dark Souls III: Ashes of Ariandel',
      gameBanner:
        'https://image.api.playstation.com/cdn/UP0700/CUSA03388_00/GYzgzVghCIlvNllqjNotnYErBNZGv1lW.png',
      summary:
        'Primeira DLC que leva os jogadores a um novo reino congelado cheio de novos desafios.',
      isDlc: true,
      parentGameId: darkSouls3.id,
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } }
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  // The Legend of Zelda: Breath of the Wild
  const zeldaBotW = await prisma.game.upsert({
    where: { gameName: 'The Legend of Zelda: Breath of the Wild' },
    update: {},
    create: {
      gameName: 'The Legend of Zelda: Breath of the Wild',
      gameBanner:
        'https://zelda.nintendo.com/breath-of-the-wild/assets/media/wallpapers/tablet-1.jpg',
      summary:
        'Uma reinvenção da série Zelda com um vasto mundo aberto e mecânicas de exploração inovadoras.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
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
          where: { studioName: 'Nintendo' },
          create: { studioName: 'Nintendo' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Nintendo' },
            create: { publisherName: 'Nintendo' }
          }
        ]
      },
      platforms: {
        connect: [{ platformName: 'Nintendo Switch' }]
      }
    }
  })

  // DLC para Cyberpunk 2077
  const phantomLiberty = await prisma.game.upsert({
    where: { gameName: 'Cyberpunk 2077: Phantom Liberty' },
    update: {},
    create: {
      gameName: 'Cyberpunk 2077: Phantom Liberty',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2138330/2e5045a9745983a73f7443dd441e6cdf0560d758/hero_capsule_2x.jpg?t=1746520760',
      summary:
        'Expansão que adiciona nova área e história envolvendo serviços secretos e conspirações governamentais.',
      isDlc: true,
      parentGameId: cyberpunk.id,
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Stardew Valley
  const stardewValley = await prisma.game.upsert({
    where: { gameName: 'Stardew Valley' },
    update: {},
    create: {
      gameName: 'Stardew Valley',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/413150/library_600x900_2x.jpg?t=1711128146',
      summary:
        'Simulador de fazenda e vida rural com elementos de RPG e exploração.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Simulation' },
            create: { categoryName: 'Simulation' }
          },
          {
            where: { categoryName: 'Indie' },
            create: { categoryName: 'Indie' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'ConcernedApe' },
          create: { studioName: 'ConcernedApe' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'ConcernedApe' },
            create: { publisherName: 'ConcernedApe' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // The Elder Scrolls V: Skyrim
  const skyrim = await prisma.game.upsert({
    where: { gameName: 'The Elder Scrolls V: Skyrim' },
    update: {},
    create: {
      gameName: 'The Elder Scrolls V: Skyrim',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/72850/library_600x900_2x.jpg?t=1721923139',
      summary:
        'Explore a vasta província de Skyrim, lute contra dragões e desenvolva seu personagem em um RPG épico de mundo aberto.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          },
          {
            where: { categoryName: 'Fantasy' },
            create: { categoryName: 'Fantasy' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Bethesda Game Studios' },
          create: { studioName: 'Bethesda Game Studios' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Bethesda Softworks' },
            create: { publisherName: 'Bethesda Softworks' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Fallout 4
  const fallout4 = await prisma.game.upsert({
    where: { gameName: 'Fallout 4' },
    update: {},
    create: {
      gameName: 'Fallout 4',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/377160/library_600x900_2x.jpg?t=1726758475',
      summary:
        'Sobreviva ao pós-apocalipse em Boston, construa assentamentos e avance na história enquanto explora o Wasteland.',
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
          where: { studioName: 'Bethesda Game Studios' },
          create: { studioName: 'Bethesda Game Studios' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Bethesda Softworks' },
            create: { publisherName: 'Bethesda Softworks' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Disco Elysium
  const discoElysium = await prisma.game.upsert({
    where: { gameName: 'Disco Elysium' },
    update: {},
    create: {
      gameName: 'Disco Elysium',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/632470/library_600x900_2x.jpg',
      summary:
        'Um RPG narrativo de mundo aberto onde você joga como um detetive com um sistema único de habilidades e uma cidade inteira para interrogar.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Detective' },
            create: { categoryName: 'Detective' }
          },
          {
            where: { categoryName: 'Indie' },
            create: { categoryName: 'Indie' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'ZA/UM' },
          create: { studioName: 'ZA/UM' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'ZA/UM' },
            create: { publisherName: 'ZA/UM' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Death Stranding
  const deathStranding = await prisma.game.upsert({
    where: { gameName: 'Death Stranding' },
    update: {},
    create: {
      gameName: 'Death Stranding',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1190460/library_600x900_2x.jpg',
      summary:
        'Em um mundo pós-apocalíptico onde entidades sobrenaturais vagam por uma terra devastada, você assume o papel de Sam Porter Bridges, transportando cargas essenciais através de um terreno hostil para reconectar comunidades isoladas.',
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
          where: { studioName: 'Kojima Productions' },
          create: { studioName: 'Kojima Productions' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Sony Interactive Entertainment' },
            create: { publisherName: 'Sony Interactive Entertainment' }
          },
          {
            where: { publisherName: '505 Games' },
            create: { publisherName: '505 Games' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' }
        ]
      }
    }
  })

  // Monster Hunter: World
  const monsterHunterWorld = await prisma.game.upsert({
    where: { gameName: 'Monster Hunter: World' },
    update: {},
    create: {
      gameName: 'Monster Hunter: World',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/582010/library_600x900_2x.jpg',
      summary:
        'Um RPG de ação onde os jogadores assumem o papel de caçadores, matando ou capturando monstros enormes em habitats naturais enquanto melhoram seus equipamentos.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Co-op' },
            create: { categoryName: 'Co-op' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Capcom' },
          create: { studioName: 'Capcom' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Capcom' },
            create: { publisherName: 'Capcom' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  const control = await prisma.game.upsert({
    where: { gameName: 'Control' },
    update: {},
    create: {
      gameName: 'Control',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/870780/library_600x900_2x.jpg',
      summary:
        'Um jogo de ação e aventura em terceira pessoa que combina tiro, poderes sobrenaturais e ambientes destrutíveis em uma agência secreta invadida por uma ameaça de outro mundo.',
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
            where: { categoryName: 'Supernatural' },
            create: { categoryName: 'Supernatural' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Remedy Entertainment' },
          create: { studioName: 'Remedy Entertainment' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: '505 Games' },
            create: { publisherName: '505 Games' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Witcher 3: Hearts of Stone
  const heartsOfStone = await prisma.game.upsert({
    where: { gameName: 'The Witcher 3: Hearts of Stone' },
    update: {},
    create: {
      gameName: 'The Witcher 3: Hearts of Stone',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/378649/2a616401d52422ab58c8e96584bdf7be5e33a7a4/hero_capsule_2x.jpg?t=1746522483',
      summary:
        'Jornada adicional com novas missões envolvendo um misterioso imortal e contratos sombrios.',
      isDlc: true,
      parentGameId: witcher3.id,
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connect: { studioName: 'CD Projekt Red' }
      },
      publishers: {
        connect: { publisherName: 'CD Projekt' }
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Witcher 3: Blood and Wine
  const bloodAndWine = await prisma.game.upsert({
    where: { gameName: 'The Witcher 3: Blood and Wine' },
    update: {},
    create: {
      gameName: 'The Witcher 3: Blood and Wine',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/378648/4388b2db7fc0bc39035a371cb5ae74e8b901ce31/hero_capsule_2x.jpg?t=1746522821',
      summary:
        'A última expansão que leva Geralt a Toussaint, reino repleto de vinhedos e mistérios mortais.',
      isDlc: true,
      parentGameId: witcher3.id,
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connect: { studioName: 'CD Projekt Red' }
      },
      publishers: {
        connect: { publisherName: 'CD Projekt' }
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Resident Evil 4 Remake
  const residentEvil4 = await prisma.game.upsert({
    where: { gameName: 'Resident Evil 4' },
    update: {},
    create: {
      gameName: 'Resident Evil 4',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2050650/library_600x900_2x.jpg',
      summary:
        'Remake do clássico de terror e sobrevivência que segue o agente Leon S. Kennedy em uma missão para resgatar a filha do presidente dos EUA em uma vila rural espanhola infestada por parasitas.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Horror' },
            create: { categoryName: 'Horror' }
          },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Survival' },
            create: { categoryName: 'Survival' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Capcom' },
          create: { studioName: 'Capcom' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Capcom' },
            create: { publisherName: 'Capcom' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Diablo IV
  const diablo4 = await prisma.game.upsert({
    where: { gameName: 'Diablo IV' },
    update: {},
    create: {
      gameName: 'Diablo IV',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2344520/196040914df808ed26d8b8fac4f0280a8559b42b/library_600x900_2x.jpg?t=1745947729',
      summary:
        'O quarto capítulo da icônica série Diablo, apresentando um vasto mundo aberto, cinco classes jogáveis e uma história sombria sobre o retorno de Lilith, a filha do ódio.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action RPG' },
            create: { categoryName: 'Action RPG' }
          },
          {
            where: { categoryName: 'Online' },
            create: { categoryName: 'Online' }
          },
          {
            where: { categoryName: 'Hack and Slash' },
            create: { categoryName: 'Hack and Slash' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Blizzard Entertainment' },
          create: { studioName: 'Blizzard Entertainment' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Blizzard Entertainment' },
            create: { publisherName: 'Blizzard Entertainment' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Hogwarts Legacy
  const hogwartsLegacy = await prisma.game.upsert({
    where: { gameName: 'Hogwarts Legacy' },
    update: {},
    create: {
      gameName: 'Hogwarts Legacy',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/990080/library_600x900_2x.jpg',
      summary:
        'Um RPG de mundo aberto ambientado no universo de Harry Potter durante o final do século 19, onde você joga como um estudante de Hogwarts com a chave para um antigo segredo.',
      categories: {
        connectOrCreate: [
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
          where: { studioName: 'Avalanche Software' },
          create: { studioName: 'Avalanche Software' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Warner Bros. Games' },
            create: { publisherName: 'Warner Bros. Games' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Star Wars Jedi: Fallen Order
  const jediFallenOrder = await prisma.game.upsert({
    where: { gameName: 'Star Wars Jedi: Fallen Order' },
    update: {},
    create: {
      gameName: 'Star Wars Jedi: Fallen Order',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172380/library_600x900_2x.jpg',
      summary:
        'Um jogo de ação-aventura que segue a história de Cal Kestis, um jovem Padawan que sobreviveu à Ordem 66 e está fugindo do Império.',
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
          where: { studioName: 'Respawn Entertainment' },
          create: { studioName: 'Respawn Entertainment' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Electronic Arts' },
            create: { publisherName: 'Electronic Arts' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Assassin's Creed Valhalla
  const acValhalla = await prisma.game.upsert({
    where: { gameName: "Assassin's Creed Valhalla" },
    update: {},
    create: {
      gameName: "Assassin's Creed Valhalla",
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2208920/library_600x900_2x.jpg?t=1736257857',
      summary:
        'Vivencie a Era Viking enquanto constrói seu assentamento na Inglaterra e enfrenta exércitos saxões em combates brutais.',
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
          where: { studioName: 'Ubisoft Montreal' },
          create: { studioName: 'Ubisoft Montreal' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Ubisoft' },
            create: { publisherName: 'Ubisoft' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Doom Eternal
  const doomEternal = await prisma.game.upsert({
    where: { gameName: 'Doom Eternal' },
    update: {},
    create: {
      gameName: 'Doom Eternal',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/782330/library_600x900_2x.jpg?t=1688646446',
      summary:
        'Encare as forças demoníacas em ritmo frenético, com armas poderosas e brutalidade sem igual.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'id Software' },
          create: { studioName: 'id Software' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Bethesda Softworks' },
            create: { publisherName: 'Bethesda Softworks' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Resident Evil Village
  const revillage = await prisma.game.upsert({
    where: { gameName: 'Resident Evil Village' },
    update: {},
    create: {
      gameName: 'Resident Evil Village',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1196590/library_600x900_2x.jpg?t=1660768007',
      summary:
        'Explore uma vila assustadora repleta de horrores góticos enquanto Ethan Winters procura sua filha desaparecida.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Horror' },
            create: { categoryName: 'Horror' }
          },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Capcom' },
          create: { studioName: 'Capcom' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Capcom' },
            create: { publisherName: 'Capcom' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Ghost of Tsushima
  const ghostTsushima = await prisma.game.upsert({
    where: { gameName: 'Ghost of Tsushima' },
    update: {},
    create: {
      gameName: 'Ghost of Tsushima',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2215430/library_600x900_2x.jpg?t=1737495883',
      summary:
        'Defenda a ilha de Tsushima da invasão mongol como o lendário samurai que se torna o "Fantasma".',
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
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Sucker Punch Productions' },
          create: { studioName: 'Sucker Punch Productions' }
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' }
        ]
      }
    }
  })

  // The Last of Us Part II
  const tlou2 = await prisma.game.upsert({
    where: { gameName: 'The Last of Us Part II' },
    update: {},
    create: {
      gameName: 'The Last of Us Part II',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2531310/aeac394b61ac94b5d4ea939351baf3943ac0b282/library_600x900_2x.jpg?t=1746152571',
      summary:
        'Continue a jornada de Ellie em um mundo pós-apocalíptico repleto de tensão e emoção.',
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
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Naughty Dog' },
          create: { studioName: 'Naughty Dog' }
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
        connect: [{ platformName: 'PC' }, { platformName: 'PS5' }]
      }
    }
  })

  // Uncharted 4: A Thief's End
  const uncharted4 = await prisma.game.upsert({
    where: { gameName: 'UNCHARTED: Legacy of Thieves Collection' },
    update: {},
    create: {
      gameName: "Uncharted 4: A Thief's End",
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1659420/library_600x900_2x.jpg',
      summary:
        'Aventure-se pelo mundo ao lado de Nathan Drake em sua busca final por tesouros lendários.',
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
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Naughty Dog' },
          create: { studioName: 'Naughty Dog' }
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
      platforms: { connect: [{ platformName: 'PC' }, { platformName: 'PS5' }] }
    }
  })

  // Metro Exodus
  const metroExodus = await prisma.game.upsert({
    where: { gameName: 'Metro Exodus' },
    update: {},
    create: {
      gameName: 'Metro Exodus',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/412020/library_600x900_2x.jpg',
      summary:
        'Sobreviva ao ermo russo pós-apocalíptico em uma narrativa intensa e linearmente expansível.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } },
          {
            where: { categoryName: 'Survival' },
            create: { categoryName: 'Survival' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: '4A Games' },
          create: { studioName: '4A Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Deep Silver' },
            create: { publisherName: 'Deep Silver' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Persona 5 Royal
  const persona5Royal = await prisma.game.upsert({
    where: { gameName: 'Persona 5 Royal' },
    update: {},
    create: {
      gameName: 'Persona 5 Royal',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1687950/library_600x900_2x.jpg',
      summary:
        'Junte-se aos Phantom Thieves em uma expansão do aclamado JRPG com novas histórias e personagens.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'JRPG' }, create: { categoryName: 'JRPG' } },
          {
            where: { categoryName: 'Turn-Based' },
            create: { categoryName: 'Turn-Based' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Atlus' },
          create: { studioName: 'Atlus' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Atlus' },
            create: { publisherName: 'Atlus' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Civilization VI
  const civ6 = await prisma.game.upsert({
    where: { gameName: "Sid Meier's Civilization VI" },
    update: {},
    create: {
      gameName: "Sid Meier's Civilization VI",
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/289070/library_600x900_2x.jpg',
      summary:
        'Construa um império que resista ao teste do tempo em um jogo de estratégia por turnos profundo e expansível.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Strategy' },
            create: { categoryName: 'Strategy' }
          },
          {
            where: { categoryName: 'Turn-Based' },
            create: { categoryName: 'Turn-Based' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Firaxis Games' },
          create: { studioName: 'Firaxis Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: '2K Games' },
            create: { publisherName: '2K Games' }
          }
        ]
      },
      platforms: {
        connect: [{ platformName: 'PC' }]
      }
    }
  })

  // Marvel's Spider-Man Remastered
  const spiderMan = await prisma.game.upsert({
    where: { gameName: "Marvel's Spider-Man Remastered" },
    update: {},
    create: {
      gameName: "Marvel's Spider-Man Remastered",
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1817070/library_600x900_2x.jpg',
      summary:
        'Balance-se pelas ruas de Nova York como o Homem-Aranha em uma aventura cinematográfica repleta de ação.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Insomniac Games' },
          create: { studioName: 'Insomniac Games' }
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
      platforms: { connect: [{ platformName: 'PC' }, { platformName: 'PS5' }] }
    }
  })

  // Outer Wilds
  const outerWilds = await prisma.game.upsert({
    where: { gameName: 'Outer Wilds' },
    update: {},
    create: {
      gameName: 'Outer Wilds',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/753640/library_600x900_2x.jpg',
      summary:
        'Descubra os mistérios de um sistema solar em loop temporal, resolvendo puzzles e explorando planetas únicos.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
          {
            where: { categoryName: 'Puzzle' },
            create: { categoryName: 'Puzzle' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Mobius Digital' },
          create: { studioName: 'Mobius Digital' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Annapurna Interactive' },
            create: { publisherName: 'Annapurna Interactive' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Cuphead
  const cuphead = await prisma.game.upsert({
    where: { gameName: 'Cuphead' },
    update: {},
    create: {
      gameName: 'Cuphead',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/268910/library_600x900_2x.jpg',
      summary:
        'Um run-and-gun com visuais desenhados à mão no estilo cartoons dos anos 1930 e trilha sonora jazzística.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Indie' },
            create: { categoryName: 'Indie' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Studio MDHR' },
          create: { studioName: 'Studio MDHR' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Studio MDHR' },
            create: { publisherName: 'Studio MDHR' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'Xbox One' },
          { platformName: 'PS4' },
          { platformName: 'Nintendo Switch' }
        ]
      }
    }
  })

  // Valheim
  const valhiem = await prisma.game.upsert({
    where: { gameName: 'Valheim' },
    update: {},
    create: {
      gameName: 'Valheim',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/892970/hero_capsule.jpg?t=1738051073',
      summary:
        'Sobreviva, construa e explore um mundo viking gerado proceduralmente, solo ou em coop com até 10 jogadores.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Survival' },
            create: { categoryName: 'Survival' }
          },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Iron Gate Studio' },
          create: { studioName: 'Iron Gate Studio' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Coffee Stain Publishing' },
            create: { publisherName: 'Coffee Stain Publishing' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Deathloop
  const deathloop = await prisma.game.upsert({
    where: { gameName: 'DEATHLOOP' },
    update: {},
    create: {
      gameName: 'Deathloop',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1252330/library_600x900_2x.jpg',
      summary:
        'Quebre um loop temporal assassinando oito alvos antes que o dia reinicie, em um shooter tático e estiloso.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Arkane Lyon' },
          create: { studioName: 'Arkane Lyon' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Bethesda Softworks' },
            create: { publisherName: 'Bethesda Softworks' }
          }
        ]
      },
      platforms: {
        connect: [{ platformName: 'PC' }, { platformName: 'PS5' }]
      }
    }
  })

  // Nier: Automata
  const nier = await prisma.game.upsert({
    where: { gameName: 'Nier: Automata' },
    update: {},
    create: {
      gameName: 'Nier: Automata',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/524220/library_600x900_2x.jpg',
      summary:
        'Ação e RPG se encontram numa narrativa filosófica que explora o que significa ser vivo.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'PlatinumGames' },
          create: { studioName: 'PlatinumGames' }
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  // Sea of Thieves
  const seaOfThieves = await prisma.game.upsert({
    where: { gameName: 'Sea of Thieves' },
    update: {},
    create: {
      gameName: 'Sea of Thieves',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172620/library_600x900_2x.jpg',
      summary:
        'Embarque em aventuras piratas em um mundo compartilhado, faça missões e bote seu navio no mar com amigos.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Adventure' },
            create: { categoryName: 'Adventure' }
          },
          { where: { categoryName: 'MMO' }, create: { categoryName: 'MMO' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Rare' },
          create: { studioName: 'Rare' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Microsoft Studios' },
            create: { publisherName: 'Microsoft Studios' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Celeste
  const celeste = await prisma.game.upsert({
    where: { gameName: 'Celeste' },
    update: {},
    create: {
      gameName: 'Celeste',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/504230/library_600x900_2x.jpg',
      summary:
        'Plataforma 2D desafiadora com pixel art e trilha sonora emocionante enquanto Madeline escala a montanha Celeste.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Platformer' },
            create: { categoryName: 'Platformer' }
          },
          {
            where: { categoryName: 'Indie' },
            create: { categoryName: 'Indie' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Matt Makes Games' },
          create: { studioName: 'Matt Makes Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Matt Makes Games' },
            create: { publisherName: 'Matt Makes Games' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Nintendo Switch' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Far Cry 6
  const farCry6 = await prisma.game.upsert({
    where: { gameName: 'Far Cry 6' },
    update: {},
    create: {
      gameName: 'Far Cry 6',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2369390/library_600x900_2x.jpg?t=1738249424',
      summary:
        'Lute contra um regime ditatorial na ilha tropical de Yara como um guerrilheiro da Libertad.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Ubisoft Toronto' },
          create: { studioName: 'Ubisoft Toronto' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Ubisoft' },
            create: { publisherName: 'Ubisoft' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'PS5' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Forza Horizon 5
  const forzaHorizon5 = await prisma.game.upsert({
    where: { gameName: 'Forza Horizon 5' },
    update: {},
    create: {
      gameName: 'Forza Horizon 5',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1551360/library_600x900_2x.jpg?t=1684906800',
      summary:
        'Corra pelo México em um dos simuladores de corrida mais bonitos e dinâmicos já criados.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Racing' },
            create: { categoryName: 'Racing' }
          },
          {
            where: { categoryName: 'Open World' },
            create: { categoryName: 'Open World' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Playground Games' },
          create: { studioName: 'Playground Games' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Microsoft Studios' },
            create: { publisherName: 'Microsoft Studios' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'Xbox One' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Age of Empires IV
  const ageOfEmpiresIV = await prisma.game.upsert({
    where: { gameName: 'Age of Empires IV' },
    update: {},
    create: {
      gameName: 'Age of Empires IV',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1466860/library_600x900_2x.jpg?t=1623118800',
      summary:
        'Comande civilizações históricas em batalhas épicas de estratégia em tempo real.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Strategy' },
            create: { categoryName: 'Strategy' }
          },
          { where: { categoryName: 'RTS' }, create: { categoryName: 'RTS' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Relic Entertainment' },
          create: { studioName: 'Relic Entertainment' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Xbox Game Studios' },
            create: { publisherName: 'Xbox Game Studios' }
          }
        ]
      },
      platforms: {
        connect: [{ platformName: 'PC' }]
      }
    }
  })

  // Kingdom Hearts III
  const kingdomHeartsIII = await prisma.game.upsert({
    where: { gameName: 'KINGDOM HEARTS III + Re Mind' },
    update: {},
    create: {
      gameName: 'Kingdom Hearts III',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2552450/library_600x900_2x.jpg',
      summary:
        'Junte-se a Sora e seus aliados em uma jornada para salvar os mundos da escuridão.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          },
          { where: { categoryName: 'RPG' }, create: { categoryName: 'RPG' } }
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  // Marvel's Guardians of the Galaxy
  const MarvelsGuardiansOfTheGalaxy = await prisma.game.upsert({
    where: { gameName: "Marvel's Guardians of the Galaxy" },
    update: {},
    create: {
      gameName: "Marvel's Guardians of the Galaxy",
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1088850/library_600x900_2x.jpg?t=1736169753',
      summary:
        'Lidere os Guardiões em uma aventura solo cheia de humor, ação e escolhas impactantes.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Eidos-Montréal' },
          create: { studioName: 'Eidos-Montréal' }
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
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Dying Light 2 Stay Human
  const dyingLight2 = await prisma.game.upsert({
    where: { gameName: 'Dying Light 2 Stay Human' },
    update: {},
    create: {
      gameName: 'Dying Light 2 Stay Human',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/534380/library_600x900_2x.jpg?t=1669843200',
      summary:
        'Explore uma cidade pós‑apocalíptica infestada por infectados, com parkour e combate visceral.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Survival' },
            create: { categoryName: 'Survival' }
          },
          {
            where: { categoryName: 'Action' },
            create: { categoryName: 'Action' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Techland' },
          create: { studioName: 'Techland' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Techland Publishing' },
            create: { publisherName: 'Techland Publishing' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS4' },
          { platformName: 'Xbox One' }
        ]
      }
    }
  })

  // Destiny 2
  const destiny2 = await prisma.game.upsert({
    where: { gameName: 'Destiny 2' },
    update: {},
    create: {
      gameName: 'Destiny 2',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1085660/library_600x900_2x.jpg?t=1670586600',
      summary:
        'Jogue como Guardião, explore sistemas solares, participe de raids e colete equipamentos poderosos.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } },
          { where: { categoryName: 'MMO' }, create: { categoryName: 'MMO' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Bungie' },
          create: { studioName: 'Bungie' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Bungie' },
            create: { publisherName: 'Bungie' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PS5' }
        ]
      }
    }
  })

  // Overwatch 2
  const overwatch2 = await prisma.game.upsert({
    where: { gameName: 'Overwatch 2' },
    update: {},
    create: {
      gameName: 'Overwatch 2',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/2357570/59281df856e9ef46fcf0c6c94cb352fe4ab18e17/library_600x900_2x.jpg',
      summary: 'Tiro em equipe com heróis únicos, modos PvP e PvE.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } },
          {
            where: { categoryName: 'Team-Based' },
            create: { categoryName: 'Team-Based' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Blizzard Entertainment' },
          create: { studioName: 'Blizzard Entertainment' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Blizzard Entertainment' },
            create: { publisherName: 'Blizzard Entertainment' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Apex Legends
  const apexLegends = await prisma.game.upsert({
    where: { gameName: 'Apex Legends' },
    update: {},
    create: {
      gameName: 'Apex Legends',
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/1172470/library_600x900_2x.jpg?t=1686856200',
      summary:
        'Battle royale com personagens únicos, habilidades especiais e combates rápidos.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Battle Royale' },
            create: { categoryName: 'Battle Royale' }
          },
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Respawn Entertainment' },
          create: { studioName: 'Respawn Entertainment' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Electronic Arts' },
            create: { publisherName: 'Electronic Arts' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // Tom Clancy's Rainbow Six Siege
  const rainbow = await prisma.game.upsert({
    where: { gameName: "Tom Clancy's Rainbow Six Siege" },
    update: {},
    create: {
      gameName: "Tom Clancy's Rainbow Six Siege",
      gameBanner:
        'https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/359550/library_600x900_2x.jpg?t=1686834000',
      summary:
        'FPS tático focado em combate entre operadores, destruição de ambientes e estratégia em equipe.',
      categories: {
        connectOrCreate: [
          { where: { categoryName: 'FPS' }, create: { categoryName: 'FPS' } },
          {
            where: { categoryName: 'Tactical' },
            create: { categoryName: 'Tactical' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Ubisoft Montreal' },
          create: { studioName: 'Ubisoft Montreal' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Ubisoft' },
            create: { publisherName: 'Ubisoft' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PC' },
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' }
        ]
      }
    }
  })

  // 1. Grand Theft Auto VI (lançamento em 26 de maio de 2026)
  const gta6 = await prisma.game.upsert({
    where: { gameName: 'Grand Theft Auto VI' },
    update: {},
    create: {
      gameName: 'Grand Theft Auto VI',
      gameBanner:
        'https://upload.wikimedia.org/wikipedia/ru/thumb/f/f0/GTA_VI_Poster.jpg/960px-GTA_VI_Poster.jpg',
      summary:
        'A próxima entrada da série Grand Theft Auto, com Vice City como cenário principal.',
      categories: {
        connectOrCreate: [
          /* Action, Open World */
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
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PC' }
        ]
      }
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id!, gameId: gta6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2026-05-26'),
      gameId: gta6.id,
      platformId: ps5Platform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxSeriesPlatform.id!, gameId: gta6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2026-05-26'),
      gameId: gta6.id,
      platformId: xboxSeriesPlatform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id!, gameId: gta6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2026-05-26'),
      gameId: gta6.id,
      platformId: pcPlatform.id!
    }
  })

  // 2. Resident Evil Requiem (lançado em 27 de fevereiro de 2026)
  const reRequiem = await prisma.game.upsert({
    where: { gameName: 'Resident Evil Requiem' },
    update: {},
    create: {
      gameName: 'Resident Evil Requiem',
      gameBanner:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/3764200/bde37e52add84267aeaf70c9f32d72381684d928/library_600x900_2x.jpg',
      summary:
        'O nono jogo principal de Resident Evil, retorno ao horror clássico em Raccoon City.',
      categories: {
        connectOrCreate: [
          /* Horror, Survival, Adventure */
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Capcom' },
          create: { studioName: 'Capcom' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Capcom' },
            create: { publisherName: 'Capcom' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PC' }
        ]
      }
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id!, gameId: reRequiem.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2026-02-27'),
      gameId: reRequiem.id,
      platformId: ps5Platform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id!,
        gameId: reRequiem.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2026-02-27'),
      gameId: reRequiem.id,
      platformId: xboxSeriesPlatform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id!, gameId: reRequiem.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2026-02-27'),
      gameId: reRequiem.id,
      platformId: pcPlatform.id!
    }
  })

  // 3. METAL GEAR SOLID Δ: Snake Eater (lançamento em 28 de agosto de 2025)
  const mgsDelta = await prisma.game.upsert({
    where: { gameName: 'METAL GEAR SOLID Δ: Snake Eater' },
    update: {},
    create: {
      gameName: 'METAL GEAR SOLID Δ: Snake Eater',
      gameBanner:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2417610/library_600x900_2x.jpg?t=1749734161',
      summary:
        'Remake do clássico MGS3, com gráficos modernos e novo modo multiplayer “Fox Hunt”.',
      categories: {
        connectOrCreate: [
          /* Action, Stealth */
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Konami' },
          create: { studioName: 'Konami' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Konami' },
            create: { publisherName: 'Konami' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PC' }
        ]
      }
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id!, gameId: mgsDelta.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-08-28'),
      gameId: mgsDelta.id,
      platformId: ps5Platform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id!,
        gameId: mgsDelta.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-08-28'),
      gameId: mgsDelta.id,
      platformId: xboxSeriesPlatform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id!, gameId: mgsDelta.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-08-28'),
      gameId: mgsDelta.id,
      platformId: pcPlatform.id!
    }
  })

  // 4. WUCHANG: Fallen Feathers (lançamento em 24 de julho de 2025)
  const wuchang = await prisma.game.upsert({
    where: { gameName: 'WUCHANG: Fallen Feathers' },
    update: {},
    create: {
      gameName: 'WUCHANG: Fallen Feathers',
      gameBanner:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2277560/f76b753512a5e146dadb4c2dc4a33775221b7fb7/library_600x900_2x.jpg',
      summary:
        'RPG soulslike ambientado na China da Dinastia Ming, com protagonista pirateira amnésica.',
      categories: {
        connectOrCreate: [
          /* Action, RPG */
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Leenzee' },
          create: { studioName: 'Leenzee' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: '505 Games' },
            create: { publisherName: '505 Games' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PC' }
        ]
      }
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id!, gameId: wuchang.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-07-24'),
      gameId: wuchang.id,
      platformId: ps5Platform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id!,
        gameId: wuchang.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-07-24'),
      gameId: wuchang.id,
      platformId: xboxSeriesPlatform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id!, gameId: wuchang.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-07-24'),
      gameId: wuchang.id,
      platformId: pcPlatform.id!
    }
  })

  // 5. Borderlands 4 – lançamento em 12 de setembro de 2025
  const borderlands4 = await prisma.game.upsert({
    where: { gameName: 'Borderlands 4' },
    update: {},
    create: {
      gameName: 'Borderlands 4',
      gameBanner:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1285190/e68c1eeacfc21e61e5a03ae81a20694856665af4/library_600x900_2x.jpg',
      summary:
        'O próximo looter‑shooter cooperativo ambientado no planeta Kairos.',
      categories: {
        connectOrCreate: [
          {
            where: { categoryName: 'Shooter' },
            create: { categoryName: 'Shooter' }
          },
          {
            where: { categoryName: 'Action RPG' },
            create: { categoryName: 'Action RPG' }
          }
        ]
      },
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Gearbox Software' },
          create: { studioName: 'Gearbox Software' }
        }
      },
      publishers: {
        connectOrCreate: [
          { where: { publisherName: '2K' }, create: { publisherName: '2K' } }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PC' }
        ]
      }
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id!,
        gameId: borderlands4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-09-12'),
      gameId: borderlands4.id,
      platformId: ps5Platform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id!,
        gameId: borderlands4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-09-12'),
      gameId: borderlands4.id,
      platformId: xboxSeriesPlatform.id!
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id!, gameId: borderlands4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-09-12'),
      gameId: borderlands4.id,
      platformId: pcPlatform.id!
    }
  })

  // 6. Death Stranding 2: On the Beach – lançamento em 26 de junho de 2025 (PS5; versão PC provável posteriormente)
  const ds2 = await prisma.game.upsert({
    where: { gameName: 'Death Stranding 2: On the Beach' },
    update: {},
    create: {
      gameName: 'Death Stranding 2: On the Beach',
      gameBanner:
        'https://upload.wikimedia.org/wikipedia/pt/4/49/Death_Stranding_2_On_The_Beach_Poster.jpg',
      summary:
        'Sequência pós‑apocalíptica de Kojima com mais liberdade, combate e transporte.',
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
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Kojima Productions' },
          create: { studioName: 'Kojima Productions' }
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
        connect: [{ platformName: 'PS5' }]
      }
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id!, gameId: ds2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2025-06-26'),
      gameId: ds2.id,
      platformId: ps5Platform.id!
    }
  })

  const mixtape = await prisma.game.upsert({
    where: { gameName: 'Mixtape' },
    update: {},
    create: {
      gameName: 'Mixtape',
      gameBanner:
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/2582320/a392d647446fb58123fb1e1651c7fa7ab234e2ee/library_600x900_2x.jpg',
      summary:
        'On their last night together, three friends embark on one final adventure. Play through a mixtape of memories, set to the soundtrack of a generation.',
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
      gameStudios: {
        connectOrCreate: {
          where: { studioName: 'Beethoven and Dinosaur' },
          create: { studioName: 'Beethoven and Dinosaur' }
        }
      },
      publishers: {
        connectOrCreate: [
          {
            where: { publisherName: 'Annapurna Interactive' },
            create: { publisherName: 'Annapurna Interactive' }
          }
        ]
      },
      platforms: {
        connect: [
          { platformName: 'PS5' },
          { platformName: 'Xbox Series X/S' },
          { platformName: 'PC' }
        ]
      }
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id!, gameId: mixtape.id }
    },
    update: {},
    create: {
      releasePeriod: '2025',
      gameId: mixtape.id,
      platformId: ps5Platform.id!
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id!,
        gameId: mixtape.id
      }
    },
    update: {},
    create: {
      releasePeriod: '2025',
      gameId: mixtape.id,
      platformId: xboxSeriesPlatform.id!
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id!, gameId: mixtape.id }
    },
    update: {},
    create: {
      releasePeriod: '2025',
      gameId: mixtape.id,
      platformId: pcPlatform.id!
    }
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

  // Lançamentos para Dark Souls III
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: darkSouls3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-04-12'),
      gameId: darkSouls3.id,
      platformId: pcPlatform.id
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

  // Red Dead Redemption 2
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: rdr2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-11-05'),
      gameId: rdr2.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: rdr2.id }
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
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: rdr2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-10-26'),
      gameId: rdr2.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Cyberpunk 2077
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: cyberpunk.id }
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
      platformId_gameId: { platformId: ps5Platform.id, gameId: cyberpunk.id }
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

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: cyberpunk.id }
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

  // God of War
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: godOfWar.id }
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
      platformId_gameId: { platformId: ps4Platform.id, gameId: godOfWar.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-04-20'),
      gameId: godOfWar.id,
      platformId: ps4Platform.id
    }
  })

  // Hades
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: hades.id }
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
      platformId_gameId: { platformId: ps5Platform.id, gameId: hades.id }
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

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: hades.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-08-13'),
      gameId: hades.id,
      platformId: switchPlatform.id
    }
  })

  // Horizon Forbidden West
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: horizonFW.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2024-03-21'),
      gameId: horizonFW.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: horizonFW.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-18'),
      gameId: horizonFW.id,
      platformId: ps4Platform.id
    }
  })

  // Final Fantasy VII Remake
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: ff7Remake.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-12-16'),
      gameId: ff7Remake.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: ff7Remake.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-04-10'),
      gameId: ff7Remake.id,
      platformId: ps4Platform.id
    }
  })

  // Baldur's Gate 3
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: baldursGate3.id }
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
      platformId_gameId: { platformId: ps5Platform.id, gameId: baldursGate3.id }
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

  // Hollow Knight
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: hollowKnight.id }
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
      platformId_gameId: { platformId: ps4Platform.id, gameId: hollowKnight.id }
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

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: hollowKnight.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-06-12'),
      gameId: hollowKnight.id,
      platformId: switchPlatform.id
    }
  })

  // Sekiro: Shadows Die Twice
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: sekiro.id }
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
      platformId_gameId: { platformId: ps4Platform.id, gameId: sekiro.id }
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
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: sekiro.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-03-22'),
      gameId: sekiro.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Dark Souls III
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: darkSouls3.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-04-12'),
      gameId: darkSouls3.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: darkSouls3.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-04-12'),
      gameId: darkSouls3.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: darkSouls3.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-04-12'),
      gameId: darkSouls3.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Dark Souls III: Ashes of Ariandel
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: ashesOfAriandel.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-10-25'),
      gameId: ashesOfAriandel.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: ashesOfAriandel.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-10-25'),
      gameId: ashesOfAriandel.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: ashesOfAriandel.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-10-25'),
      gameId: ashesOfAriandel.id,
      platformId: xboxOnePlatform.id
    }
  })

  // The Legend of Zelda: Breath of the Wild
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: zeldaBotW.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-03-03'),
      gameId: zeldaBotW.id,
      platformId: switchPlatform.id
    }
  })

  // Cyberpunk 2077: Phantom Liberty
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: phantomLiberty.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-09-26'),
      gameId: phantomLiberty.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: phantomLiberty.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-09-26'),
      gameId: phantomLiberty.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: phantomLiberty.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-09-26'),
      gameId: phantomLiberty.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Stardew Valley
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: stardewValley.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-02-26'),
      gameId: stardewValley.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: stardewValley.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-04'),
      gameId: stardewValley.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: stardewValley.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-04'),
      gameId: stardewValley.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: stardewValley.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-10-05'),
      gameId: stardewValley.id,
      platformId: switchPlatform.id
    }
  })

  // The Elder Scrolls V: Skyrim
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: skyrim.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2011-11-11'),
      gameId: skyrim.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: skyrim.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-10-28'),
      gameId: skyrim.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: skyrim.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-11'),
      gameId: skyrim.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: skyrim.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-10-28'),
      gameId: skyrim.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: skyrim.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-11'),
      gameId: skyrim.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: skyrim.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-11-17'),
      gameId: skyrim.id,
      platformId: switchPlatform.id
    }
  })

  // Fallout 4
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: fallout4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-11-10'),
      gameId: fallout4.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: fallout4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-11-10'),
      gameId: fallout4.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: fallout4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2024-04-25'),
      gameId: fallout4.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: fallout4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-11-10'),
      gameId: fallout4.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: fallout4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2024-04-25'),
      gameId: fallout4.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Disco Elysium
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: discoElysium.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-15'),
      gameId: discoElysium.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: discoElysium.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-30'),
      gameId: discoElysium.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: discoElysium.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-30'),
      gameId: discoElysium.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: discoElysium.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-30'),
      gameId: discoElysium.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: discoElysium.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-30'),
      gameId: discoElysium.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: discoElysium.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-12'),
      gameId: discoElysium.id,
      platformId: switchPlatform.id
    }
  })

  // Death Stranding
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: deathStranding.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-07-14'),
      gameId: deathStranding.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: deathStranding.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-11-08'),
      gameId: deathStranding.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: deathStranding.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-03-30'),
      gameId: deathStranding.id,
      platformId: ps5Platform.id
    }
  })

  // Monster Hunter: World
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: monsterHunterWorld.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-08-09'),
      gameId: monsterHunterWorld.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: monsterHunterWorld.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-01-26'),
      gameId: monsterHunterWorld.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: monsterHunterWorld.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-01-26'),
      gameId: monsterHunterWorld.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Control
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: control.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-08-27'),
      gameId: control.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: control.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-08-27'),
      gameId: control.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: control.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-02-02'),
      gameId: control.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: control.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-08-27'),
      gameId: control.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: control.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-02-02'),
      gameId: control.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Resident Evil 4 Remake
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: residentEvil4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-03-24'),
      gameId: residentEvil4.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: residentEvil4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-03-24'),
      gameId: residentEvil4.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: residentEvil4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-03-24'),
      gameId: residentEvil4.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: residentEvil4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-03-24'),
      gameId: residentEvil4.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Diablo IV
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: diablo4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-06-05'),
      gameId: diablo4.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: diablo4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-06-05'),
      gameId: diablo4.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: diablo4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-06-05'),
      gameId: diablo4.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: diablo4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-06-05'),
      gameId: diablo4.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: diablo4.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-06-05'),
      gameId: diablo4.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Hogwarts Legacy
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: hogwartsLegacy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-02-10'),
      gameId: hogwartsLegacy.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: hogwartsLegacy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-05-05'),
      gameId: hogwartsLegacy.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: hogwartsLegacy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-02-10'),
      gameId: hogwartsLegacy.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: hogwartsLegacy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-05-05'),
      gameId: hogwartsLegacy.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: hogwartsLegacy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-02-10'),
      gameId: hogwartsLegacy.id,
      platformId: xboxSeriesPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: hogwartsLegacy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-11-14'),
      gameId: hogwartsLegacy.id,
      platformId: switchPlatform.id
    }
  })

  // Star Wars Jedi: Fallen Order
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: jediFallenOrder.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-03-06'),
      gameId: jediFallenOrder.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: jediFallenOrder.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-11-15'),
      gameId: jediFallenOrder.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: jediFallenOrder.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: jediFallenOrder.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: jediFallenOrder.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-11-15'),
      gameId: jediFallenOrder.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: jediFallenOrder.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: jediFallenOrder.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Assassin's Creed Valhalla
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: acValhalla.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: acValhalla.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: acValhalla.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: acValhalla.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: acValhalla.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: acValhalla.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: acValhalla.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: acValhalla.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: acValhalla.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: acValhalla.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Doom Eternal
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: doomEternal.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-03-20'),
      gameId: doomEternal.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: doomEternal.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-03-20'),
      gameId: doomEternal.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: doomEternal.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-28'),
      gameId: doomEternal.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: doomEternal.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-03-20'),
      gameId: doomEternal.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: doomEternal.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-28'),
      gameId: doomEternal.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Resident Evil Village
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: revillage.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-05-07'),
      gameId: revillage.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: revillage.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-05-07'),
      gameId: revillage.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: revillage.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-01-25'),
      gameId: revillage.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: revillage.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-05-07'),
      gameId: revillage.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: revillage.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-01-25'),
      gameId: revillage.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Ghost of Tsushima
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: ghostTsushima.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2024-05-16'),
      gameId: ghostTsushima.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: ghostTsushima.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-07-17'),
      gameId: ghostTsushima.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: ghostTsushima.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-08-20'),
      gameId: ghostTsushima.id,
      platformId: ps5Platform.id
    }
  })

  // The Last of Us Part II
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: tlou2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-01-18'),
      gameId: tlou2.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: tlou2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-06-19'),
      gameId: tlou2.id,
      platformId: ps5Platform.id
    }
  })

  // Uncharted 4: A Thief's End
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: uncharted4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-10-19'),
      gameId: uncharted4.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: uncharted4.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-05-10'),
      gameId: uncharted4.id,
      platformId: ps5Platform.id
    }
  })

  // Metro Exodus
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: metroExodus.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-02-15'),
      gameId: metroExodus.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: metroExodus.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-02-15'),
      gameId: metroExodus.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: metroExodus.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-06-18'),
      gameId: metroExodus.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: metroExodus.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-02-15'),
      gameId: metroExodus.id,
      platformId: xboxOnePlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: metroExodus.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-06-18'),
      gameId: metroExodus.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Persona 5 Royal
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: persona5Royal.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-10-21'),
      gameId: persona5Royal.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: persona5Royal.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-31'),
      gameId: persona5Royal.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: persona5Royal.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-31'),
      gameId: persona5Royal.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: persona5Royal.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-10-21'),
      gameId: persona5Royal.id,
      platformId: xboxSeriesPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: persona5Royal.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-10-21'),
      gameId: persona5Royal.id,
      platformId: switchPlatform.id
    }
  })

  // Civilization VI
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: civ6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-10-21'),
      gameId: civ6.id,
      platformId: pcPlatform.id
    }
  })

  // Marvel's Spider-Man Remastered
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: spiderMan.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-08-12'),
      gameId: spiderMan.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: spiderMan.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: spiderMan.id,
      platformId: ps5Platform.id
    }
  })

  // Outer Wilds - Lançado em 30 de maio de 2019
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: outerWilds.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-05-30'),
      gameId: outerWilds.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: outerWilds.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-15'),
      gameId: outerWilds.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: outerWilds.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: outerWilds.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: outerWilds.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-06-18'),
      gameId: outerWilds.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: outerWilds.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: outerWilds.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Cuphead - Lançado em 29 de setembro de 2017
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: cuphead.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-09-29'),
      gameId: cuphead.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: cuphead.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-09-29'),
      gameId: cuphead.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: cuphead.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-07-28'),
      gameId: cuphead.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: cuphead.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-04-18'),
      gameId: cuphead.id,
      platformId: switchPlatform.id
    }
  })

  // Valheim - Lançado em 2 de fevereiro de 2021
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: valhiem.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-02-02'),
      gameId: valhiem.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: valhiem.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-03-14'),
      gameId: valhiem.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: valhiem.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2023-03-14'),
      gameId: valhiem.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Deathloop - Lançado em 14 de setembro de 2021
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: deathloop.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-09-14'),
      gameId: deathloop.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: deathloop.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-09-14'),
      gameId: deathloop.id,
      platformId: ps5Platform.id
    }
  })

  // Nier: Automata - Lançado em 23 de fevereiro de 2017
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: nier.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-03-17'),
      gameId: nier.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: nier.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-02-23'),
      gameId: nier.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: nier.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-06-26'),
      gameId: nier.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Sea of Thieves - Lançado em 20 de março de 2018
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: seaOfThieves.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-03-20'),
      gameId: seaOfThieves.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: seaOfThieves.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-03-20'),
      gameId: seaOfThieves.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: seaOfThieves.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: seaOfThieves.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Celeste - Lançado em 25 de janeiro de 2018
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: celeste.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-01-25'),
      gameId: celeste.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: celeste.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-01-25'),
      gameId: celeste.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: celeste.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: celeste.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: celeste.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-01-25'),
      gameId: celeste.id,
      platformId: switchPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: celeste.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2018-01-25'),
      gameId: celeste.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: celeste.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: celeste.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Far Cry 6 - Lançado em 7 de outubro de 2021
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: farCry6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-07'),
      gameId: farCry6.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: farCry6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-07'),
      gameId: farCry6.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: farCry6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-07'),
      gameId: farCry6.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: xboxOnePlatform.id, gameId: farCry6.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-07'),
      gameId: farCry6.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: farCry6.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-07'),
      gameId: farCry6.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Forza Horizon 5 - Lançado em 9 de novembro de 2021
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: forzaHorizon5.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-09'),
      gameId: forzaHorizon5.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: forzaHorizon5.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-09'),
      gameId: forzaHorizon5.id,
      platformId: xboxOnePlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: forzaHorizon5.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-11-09'),
      gameId: forzaHorizon5.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Age of Empires IV - Lançado em 28 de outubro de 2021
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: ageOfEmpiresIV.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-28'),
      gameId: ageOfEmpiresIV.id,
      platformId: pcPlatform.id
    }
  })

  // Kingdom Hearts III - Lançado em 29 de janeiro de 2019
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: kingdomHeartsIII.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-03-30'),
      gameId: kingdomHeartsIII.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: kingdomHeartsIII.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-01-29'),
      gameId: kingdomHeartsIII.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: kingdomHeartsIII.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-01-29'),
      gameId: kingdomHeartsIII.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Marvel's Guardians of the Galaxy - Lançado em 26 de outubro de 2021
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: pcPlatform.id,
        gameId: MarvelsGuardiansOfTheGalaxy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-26'),
      gameId: MarvelsGuardiansOfTheGalaxy.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: MarvelsGuardiansOfTheGalaxy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-26'),
      gameId: MarvelsGuardiansOfTheGalaxy.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: MarvelsGuardiansOfTheGalaxy.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2021-10-26'),
      gameId: MarvelsGuardiansOfTheGalaxy.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Dying Light 2 Stay Human - Lançado em 4 de fevereiro de 2022
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: dyingLight2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-04'),
      gameId: dyingLight2.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: dyingLight2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-04'),
      gameId: dyingLight2.id,
      platformId: ps4Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: dyingLight2.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-02-04'),
      gameId: dyingLight2.id,
      platformId: xboxOnePlatform.id
    }
  })

  // Destiny 2 - Lançado em 6 de setembro de 2017
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: destiny2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2017-10-24'),
      gameId: destiny2.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: destiny2.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: destiny2.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: destiny2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: destiny2.id,
      platformId: ps5Platform.id
    }
  })

  // Overwatch 2 - Lançado em 4 de outubro de 2022
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: overwatch2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-10-04'),
      gameId: overwatch2.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: overwatch2.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-10-04'),
      gameId: overwatch2.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: overwatch2.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-10-04'),
      gameId: overwatch2.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Apex Legends - Lançado em 4 de fevereiro de 2019
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: apexLegends.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-02-04'),
      gameId: apexLegends.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: apexLegends.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-12'),
      gameId: apexLegends.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: apexLegends.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-11-10'),
      gameId: apexLegends.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // Tom Clancy's Rainbow Six Siege - Lançado em 1 de dezembro de 2015
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: rainbow.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-12-01'),
      gameId: rainbow.id,
      platformId: pcPlatform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: rainbow.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-12-01'),
      gameId: rainbow.id,
      platformId: ps5Platform.id
    }
  })

  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: rainbow.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2020-12-01'),
      gameId: rainbow.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // The Witcher 3: Hearts of Stone – lançado em 13 de outubro de 2015 (PC, PS4, Xbox One) :contentReference[oaicite:0]{index=0}
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: heartsOfStone.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-10-13'),
      gameId: heartsOfStone.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps4Platform.id,
        gameId: heartsOfStone.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-10-13'),
      gameId: heartsOfStone.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: heartsOfStone.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2015-10-13'),
      gameId: heartsOfStone.id,
      platformId: xboxOnePlatform.id
    }
  })

  // The Witcher 3: Hearts of Stone – lançado em 15 de outubro de 2019 (Nintendo Switch) :contentReference[oaicite:1]{index=1}
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: heartsOfStone.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-15'),
      gameId: heartsOfStone.id,
      platformId: switchPlatform.id
    }
  })

  // The Witcher 3: Hearts of Stone – lançado em 14 de dezembro de 2022 (PS5, Xbox Series X/S) :contentReference[oaicite:2]{index=2}
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: ps5Platform.id,
        gameId: heartsOfStone.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-12-14'),
      gameId: heartsOfStone.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: heartsOfStone.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-12-14'),
      gameId: heartsOfStone.id,
      platformId: xboxSeriesPlatform.id
    }
  })

  // The Witcher 3: Blood and Wine – lançado em 31 de maio de 2016 (PC, PS4, Xbox One) :contentReference[oaicite:3]{index=3}
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: pcPlatform.id, gameId: bloodAndWine.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-05-31'),
      gameId: bloodAndWine.id,
      platformId: pcPlatform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps4Platform.id, gameId: bloodAndWine.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-05-31'),
      gameId: bloodAndWine.id,
      platformId: ps4Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxOnePlatform.id,
        gameId: bloodAndWine.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2016-05-31'),
      gameId: bloodAndWine.id,
      platformId: xboxOnePlatform.id
    }
  })

  // The Witcher 3: Blood and Wine – lançado em 15 de outubro de 2019 (Nintendo Switch) :contentReference[oaicite:4]{index=4}
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: switchPlatform.id,
        gameId: bloodAndWine.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2019-10-15'),
      gameId: bloodAndWine.id,
      platformId: switchPlatform.id
    }
  })

  // The Witcher 3: Blood and Wine – lançado em 14 de dezembro de 2022 (PS5, Xbox Series X/S) :contentReference[oaicite:5]{index=5}
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: { platformId: ps5Platform.id, gameId: bloodAndWine.id }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-12-14'),
      gameId: bloodAndWine.id,
      platformId: ps5Platform.id
    }
  })
  await prisma.gameLauncher.upsert({
    where: {
      platformId_gameId: {
        platformId: xboxSeriesPlatform.id,
        gameId: bloodAndWine.id
      }
    },
    update: {},
    create: {
      dateRelease: new Date('2022-12-14'),
      gameId: bloodAndWine.id,
      platformId: xboxSeriesPlatform.id
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
