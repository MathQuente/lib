import 'dotenv/config'
import bcrypt from 'bcrypt'
import { Console, Platform } from '@prisma/client'
import { prisma } from '../src/database/db'
import { IGDBService } from '../src/services/igdb.service'
import { getSeedPassword } from '../src/utils/seed-password'

const OWNER_EMAIL = process.env.SEED_LIBRARY_USER_EMAIL
const GAME_COUNT = Number(process.env.SEED_GAME_COUNT ?? 8)
const EMAIL_PREFIX = 'seed-reviews-'
const EMAIL_DOMAIN = '@teste.local'

const PLAYED = 1
const PAUSED = 2
const PLAYING = 3
const BACKLOG = 4
const WISHLIST = 5
const DROPPED = 6

interface PlatformSeed {
  platform: Platform
  console?: Console
  hoursPlayed: number
  completions: number
}

interface Scenario {
  label: string
  statusId: number
  hoursPlayed: number
  completions: number
  rating: number | null
  review: string | null
  platforms?: PlatformSeed[]
}

const SCENARIOS: Scenario[] = [
  {
    label: 'played, replayed 3 times',
    statusId: PLAYED,
    hoursPlayed: 82,
    completions: 3,
    rating: 5,
    review:
      'Já zerei três vezes e ainda descubro coisa nova a cada partida. Para mim, um dos melhores da geração.'
  },
  {
    label: 'played once',
    statusId: PLAYED,
    hoursPlayed: 31.5,
    completions: 1,
    rating: 3.5,
    review:
      'Terminei e gostei, mas o ritmo cai no meio. A parte final compensa.'
  },
  {
    label: 'playing now',
    statusId: PLAYING,
    hoursPlayed: 12,
    completions: 0,
    rating: 4,
    review: 'Ainda no começo, mas já está me prendendo bastante.'
  },
  {
    label: 'paused',
    statusId: PAUSED,
    hoursPlayed: 18.25,
    completions: 0,
    rating: 3,
    review:
      'Parei numa parte mais travada e ainda não voltei. Pretendo retomar.'
  },
  {
    label: 'dropped',
    statusId: DROPPED,
    hoursPlayed: 3.5,
    completions: 0,
    rating: 2,
    review: 'Não consegui entrar no jogo, larguei nas primeiras horas.'
  },
  {
    label: 'back in the queue, finished 4 times on 3 platforms',
    statusId: BACKLOG,
    hoursPlayed: 108,
    completions: 4,
    rating: 4.5,
    review:
      'Zerei em três plataformas e voltei o jogo para a fila para rejogar mais pra frente.',
    platforms: [
      { platform: 'STEAM', hoursPlayed: 60, completions: 2 },
      { platform: 'PLAYSTATION', hoursPlayed: 30, completions: 1 },
      {
        platform: 'XBOX',
        console: 'XBOX_360',
        hoursPlayed: 10,
        completions: 1
      },
      {
        platform: 'XBOX',
        console: 'XBOX_ONE',
        hoursPlayed: 8,
        completions: 0
      }
    ]
  },
  {
    label: 'in the queue, nothing registered',
    statusId: BACKLOG,
    hoursPlayed: 0,
    completions: 0,
    rating: null,
    review: null
  },
  {
    label: 'wishlist',
    statusId: WISHLIST,
    hoursPlayed: 0,
    completions: 0,
    rating: null,
    review: null
  },
  {
    label: 'played, rated without a review',
    statusId: PLAYED,
    hoursPlayed: 24,
    completions: 1,
    rating: 4,
    review: null
  }
]

async function clean() {
  const result = await prisma.user.deleteMany({
    where: { email: { startsWith: EMAIL_PREFIX, endsWith: EMAIL_DOMAIN } }
  })
  console.log(`Removed ${result.count} seed users (cascade).`)
}

async function findOwnerId() {
  if (OWNER_EMAIL) {
    const owner = await prisma.user.findUnique({
      where: { email: OWNER_EMAIL },
      select: { id: true }
    })
    if (!owner) throw new Error(`No user with email ${OWNER_EMAIL}.`)
    return owner.id
  }
  const [top] = await prisma.userGame.groupBy({
    by: ['userId'],
    _count: { userId: true },
    orderBy: { _count: { userId: 'desc' } },
    take: 1
  })
  if (!top) throw new Error('No user has a library yet.')
  return top.userId
}

async function pickGames(ownerId: string) {
  const recent = await prisma.userGame.findMany({
    where: { userId: ownerId },
    orderBy: { updatedAt: 'desc' },
    take: 200,
    select: { igdbId: true }
  })
  const cached = await prisma.gameCache.findMany({
    where: { igdbId: { in: recent.map(r => r.igdbId) } },
    select: { igdbId: true, name: true, releaseDate: true, gameModes: true }
  })
  const byId = new Map(cached.map(c => [c.igdbId, c]))
  const now = Date.now() / 1000
  const picked = []
  for (const { igdbId } of recent) {
    const game = byId.get(igdbId)
    if (!game) continue
    if (game.releaseDate != null && game.releaseDate > now) continue
    picked.push(game)
    if (picked.length === GAME_COUNT) break
  }
  return picked
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean()
    return
  }

  const passwordHash = await bcrypt.hash(getSeedPassword(), 12)
  const ownerId = await findOwnerId()
  const games = await pickGames(ownerId)
  if (games.length === 0) throw new Error('No released games found.')

  const users = []
  for (let k = 0; k < SCENARIOS.length; k++) {
    const email = `${EMAIL_PREFIX}${k + 1}${EMAIL_DOMAIN}`
    users.push(
      await prisma.user.upsert({
        where: { email },
        update: { password: passwordHash, emailVerifiedAt: new Date() },
        create: {
          email,
          userName: `Seed Resenhista ${k + 1}`,
          password: passwordHash,
          emailVerifiedAt: new Date()
        }
      })
    )
  }

  for (let g = 0; g < games.length; g++) {
    const game = games[g]
    const endless = IGDBService.suggestsEndless(game)
    console.log(`\n${game.name} (${game.igdbId})${endless ? ' [endless]' : ''}`)

    for (let k = 0; k < users.length; k++) {
      const user = users[k]
      const scenario = SCENARIOS[(k + g) % SCENARIOS.length]
      const completedAt =
        scenario.completions > 0
          ? new Date(Date.now() - (g * 9 + k + 1) * 86_400_000)
          : null

      const userGame = await prisma.userGame.upsert({
        where: { userId_igdbId: { userId: user.id, igdbId: game.igdbId } },
        update: {
          userGamesStatusId: scenario.statusId,
          completedAt,
          endless
        },
        create: {
          userId: user.id,
          igdbId: game.igdbId,
          userGamesStatusId: scenario.statusId,
          completedAt,
          endless
        }
      })

      await prisma.userGameStats.upsert({
        where: { userGameId: userGame.id },
        update: {
          hoursPlayed: scenario.hoursPlayed,
          completions: scenario.completions
        },
        create: {
          userGameId: userGame.id,
          hoursPlayed: scenario.hoursPlayed,
          completions: scenario.completions
        }
      })

      await prisma.userGamePlatform.deleteMany({
        where: { userGameId: userGame.id }
      })
      for (const p of scenario.platforms ?? []) {
        await prisma.userGamePlatform.create({
          data: {
            userGameId: userGame.id,
            platform: p.platform,
            console: p.console,
            hoursPlayed: p.hoursPlayed,
            completions: p.completions,
            completedAt: p.completions > 0 ? completedAt : null
          }
        })
      }

      if (scenario.rating != null) {
        await prisma.rating.upsert({
          where: { userId_igdbId: { userId: user.id, igdbId: game.igdbId } },
          update: { value: scenario.rating },
          create: {
            userId: user.id,
            igdbId: game.igdbId,
            value: scenario.rating
          }
        })
      } else {
        await prisma.rating.deleteMany({
          where: { userId: user.id, igdbId: game.igdbId }
        })
      }

      if (scenario.review) {
        await prisma.review.upsert({
          where: { userId_igdbId: { userId: user.id, igdbId: game.igdbId } },
          update: { text: scenario.review },
          create: {
            userId: user.id,
            igdbId: game.igdbId,
            text: scenario.review
          }
        })
      } else {
        await prisma.review.deleteMany({
          where: { userId: user.id, igdbId: game.igdbId }
        })
      }

      console.log(`  ${user.userName}: ${scenario.label}`)
    }
  }

  console.log(
    `\nDone: ${users.length} users x ${games.length} games. Remove with: npm run seed:reviews -- --clean`
  )
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
