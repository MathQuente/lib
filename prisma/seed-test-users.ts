import 'dotenv/config'
import bcrypt from 'bcrypt'
import { prisma } from '../src/database/db'

const MATHQUENTE_ID = '6642b677-b7da-4f84-818a-2776174444b9'
const PLAYED = 1
const PLAYING = 3
const BACKLOG = 4
const WISHLIST = 5

const REVIEW_TEXTS = [
  'Um dos melhores jogos que já joguei, recomendo muito.',
  'Bom jogo, mas achei um pouco repetitivo depois de um tempo.',
  'História incrível, gameplay mediano.',
  'Não gostei muito, esperava mais.',
  'Excelente trilha sonora e level design.',
  'Divertido pra jogar com amigos, sozinho cansa rápido.'
]

interface TestUserPlan {
  email: string
  userName: string
  gameCount: number
  withReviews: boolean
}

const PLANS: TestUserPlan[] = [
  { email: 'sem.jogos@teste.com', userName: 'SemJogosTeste', gameCount: 0, withReviews: false },
  { email: 'poucos.jogos@teste.com', userName: 'PoucosJogosTeste', gameCount: 3, withReviews: true },
  { email: 'muitos.jogos@teste.com', userName: 'MuitosJogosTeste', gameCount: 80, withReviews: true },
  { email: 'reviewer@teste.com', userName: 'ReviewerTeste', gameCount: 15, withReviews: true }
]

async function main() {
  const passwordHash = await bcrypt.hash('123456', 10)

  const games = await prisma.gameCache.findMany({
    take: 200,
    orderBy: { totalRatingCount: 'desc' },
    select: { igdbId: true }
  })

  if (games.length === 0) {
    throw new Error('games_cache is empty — run sync:igdb first.')
  }

  let gameCursor = 0
  function nextGames(count: number) {
    const slice: number[] = []
    for (let i = 0; i < count; i++) {
      slice.push(games[gameCursor % games.length].igdbId)
      gameCursor++
    }
    return slice
  }

  for (const plan of PLANS) {
    const user = await prisma.user.upsert({
      where: { email: plan.email },
      update: { userName: plan.userName },
      create: {
        email: plan.email,
        userName: plan.userName,
        password: passwordHash
      }
    })

    console.log(`User ${plan.userName} (${user.id}) — ${plan.gameCount} games`)

    const igdbIds = nextGames(plan.gameCount)

    for (let i = 0; i < igdbIds.length; i++) {
      const igdbId = igdbIds[i]

      const statusId =
        i % 5 === 0 ? WISHLIST : i % 4 === 0 ? BACKLOG : i % 7 === 0 ? PLAYING : PLAYED

      const userGame = await prisma.userGame.upsert({
        where: { userId_igdbId: { userId: user.id, igdbId } },
        update: {},
        create: { userId: user.id, igdbId, userGamesStatusId: statusId }
      })

      await prisma.userGameStats.upsert({
        where: { userGameId: userGame.id },
        update: {},
        create: {
          userGameId: userGame.id,
          completions: statusId === PLAYED ? 1 : 0,
          hoursPlayed: Math.round(Math.random() * 8000) / 100
        }
      })

      if (plan.withReviews && statusId === PLAYED && i % 2 === 0) {
        await prisma.review.upsert({
          where: { userId_igdbId: { userId: user.id, igdbId } },
          update: {},
          create: {
            userId: user.id,
            igdbId,
            text: REVIEW_TEXTS[i % REVIEW_TEXTS.length]
          }
        })

        await prisma.rating.upsert({
          where: { userId_igdbId: { userId: user.id, igdbId } },
          update: {},
          create: {
            userId: user.id,
            igdbId,
            value: Math.round((2.5 + Math.random() * 2.5) * 2) / 2
          }
        })
      }
    }

    await prisma.follow.upsert({
      where: {
        followerId_followingId: {
          followerId: user.id,
          followingId: MATHQUENTE_ID
        }
      },
      update: {},
      create: { followerId: user.id, followingId: MATHQUENTE_ID }
    })
  }

  console.log('\nDone. Login password for all test users: 123456')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
