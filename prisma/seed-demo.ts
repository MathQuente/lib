import 'dotenv/config'
import crypto from 'node:crypto'
import bcrypt from 'bcrypt'
import { Platform, Prisma } from '@prisma/client'
import { prisma } from '../src/database/db'
import { IGDBService } from '../src/services/igdb.service'
import { getSeedPassword } from '../src/utils/seed-password'
import { createRng } from './seed-demo/random'
import {
  FIRST_NAMES,
  IN_PROGRESS_REVIEW_TEXTS,
  LAST_NAMES,
  REVIEW_TEXTS,
  bandForRating
} from './seed-demo/data'

const USER_COUNT = 80
const GAME_COUNT = 60
const EMAIL_PREFIX = 'demo-'
const EMAIL_DOMAIN = '@teste.local'
const SEED = Number(process.env.SEED_DEMO_SEED ?? 42)
const FOLLOW_EMAIL = process.env.SEED_DEMO_FOLLOW_EMAIL
const AVATAR_STYLE = process.env.SEED_DEMO_AVATAR_STYLE ?? 'lorelei'
const BATCH_SIZE = 1000
const DAY_MS = 86_400_000

const PLAYED = 1
const PAUSED = 2
const PLAYING = 3
const BACKLOG = 4
const WISHLIST = 5
const DROPPED = 6

const STATUS_IDS = [PLAYED, BACKLOG, WISHLIST, DROPPED, PLAYING, PAUSED]
const STATUS_WEIGHTS = [45, 20, 12, 8, 10, 5]
const REVIEWABLE = [PLAYED, PAUSED, PLAYING, DROPPED]
const RATING_VALUES = [1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
const RATING_WEIGHTS = [2, 2, 4, 6, 10, 16, 24, 20, 16]
const DROPPED_RATING_WEIGHTS = [10, 10, 16, 20, 22, 12, 6, 3, 1]
const PLATFORMS: Platform[] = [
  'STEAM',
  'PLAYSTATION',
  'XBOX',
  'NINTENDO',
  'EPIC',
  'GOG'
]

const rng = createRng(SEED)

type Game = Awaited<ReturnType<typeof loadGames>>[number]

async function loadGames() {
  const now = Math.floor(Date.now() / 1000)
  return prisma.gameCache.findMany({
    where: {
      coverUrl: { not: null },
      parentGameId: null,
      totalRatingCount: { not: null },
      OR: [{ releaseDate: null }, { releaseDate: { lte: now } }]
    },
    orderBy: { totalRatingCount: 'desc' },
    take: GAME_COUNT,
    select: {
      igdbId: true,
      name: true,
      releaseDate: true,
      totalRatingCount: true,
      gameModes: true
    }
  })
}

async function insertInBatches<T>(
  rows: T[],
  write: (batch: T[]) => Promise<unknown>
) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await write(rows.slice(i, i + BATCH_SIZE))
  }
}

function demoEmailFilter(): Prisma.UserWhereInput {
  return { email: { startsWith: EMAIL_PREFIX, endsWith: EMAIL_DOMAIN } }
}

async function clean() {
  const result = await prisma.user.deleteMany({ where: demoEmailFilter() })
  console.log(`Removed ${result.count} demo users (cascade).`)
}

function uniqueUserNames(count: number) {
  const used = new Set<string>()
  const names: string[] = []
  while (names.length < count) {
    const name = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`.slice(0, 30)
    if (used.has(name)) continue
    used.add(name)
    names.push(name)
  }
  return names
}

function roundHours(value: number) {
  return Math.round(value * 100) / 100
}

function statsFor(statusId: number) {
  switch (statusId) {
    case PLAYED: {
      const completions = rng.chance(0.85) ? 1 : rng.between(2, 4)
      const hours = rng.logNormal(22, 0.7) * (1 + (completions - 1) * 0.7)
      return { hours: roundHours(Math.max(1.5, hours)), completions }
    }
    case PLAYING:
      return {
        hours: roundHours(Math.max(0.5, rng.logNormal(10, 0.8))),
        completions: 0
      }
    case PAUSED:
      return {
        hours: roundHours(Math.max(1, rng.logNormal(12, 0.7))),
        completions: 0
      }
    case DROPPED:
      return {
        hours: roundHours(Math.max(0.5, rng.logNormal(3, 0.6))),
        completions: 0
      }
    case BACKLOG: {
      if (!rng.chance(0.25)) return { hours: 0, completions: 0 }
      const completions = rng.chance(0.6) ? rng.between(1, 3) : 0
      const hours = rng.logNormal(20, 0.7) * Math.max(1, completions)
      return { hours: roundHours(Math.max(1, hours)), completions }
    }
    default:
      return { hours: 0, completions: 0 }
  }
}

function splitAcrossPlatforms(
  hours: number,
  completions: number,
  completedAt: Date | null
) {
  const count = rng.between(1, 3)
  const platforms = rng
    .weightedSample(PLATFORMS, [5, 3, 2, 2, 1, 1], count)
    .map(platform => ({ platform, hours: 0, completions: 0 }))

  const shares = platforms.map(() => rng.next() + 0.2)
  const shareTotal = shares.reduce((sum, s) => sum + s, 0)
  platforms.forEach((p, i) => {
    p.hours = roundHours((hours * shares[i]) / shareTotal)
  })
  for (let c = 0; c < completions; c++) {
    platforms[rng.between(0, platforms.length - 1)].completions++
  }

  const totalHours = roundHours(platforms.reduce((sum, p) => sum + p.hours, 0))
  const totalCompletions = platforms.reduce((sum, p) => sum + p.completions, 0)
  return {
    totalHours,
    totalCompletions,
    rows: platforms.map(p => ({
      ...p,
      completedAt: p.completions > 0 ? completedAt : null
    }))
  }
}

function pickReviewText(
  rating: number,
  gameName: string,
  used: Set<string>,
  inProgress: boolean
) {
  const pool = (inProgress ? IN_PROGRESS_REVIEW_TEXTS : REVIEW_TEXTS)[
    bandForRating(rating)
  ]
  let text = rng.pick(pool)
  for (let attempt = 0; attempt < 10 && used.has(text); attempt++) {
    text = rng.pick(pool)
  }
  used.add(text)
  return text.replaceAll('{jogo}', gameName)
}

async function main() {
  if (process.argv.includes('--clean')) {
    await clean()
    return
  }

  const passwordHash = await bcrypt.hash(getSeedPassword(), 12)
  const games = await loadGames()
  if (games.length < GAME_COUNT) {
    throw new Error(
      `Only ${games.length} eligible games in games_cache; need ${GAME_COUNT}.`
    )
  }

  await clean()

  const now = Date.now()
  const names = uniqueUserNames(USER_COUNT)
  const { createAvatar } = await import('@dicebear/core')
  const collection = await import('@dicebear/collection')
  const avatarStyle = (collection as Record<string, unknown>)[AVATAR_STYLE]
  if (!avatarStyle) throw new Error(`Unknown avatar style ${AVATAR_STYLE}.`)

  const users = names.map((userName, i) => {
    const createdAt = new Date(now - rng.between(30, 365) * DAY_MS)
    return {
      id: crypto.randomUUID(),
      email: `${EMAIL_PREFIX}${String(i + 1).padStart(2, '0')}${EMAIL_DOMAIN}`,
      userName,
      password: passwordHash,
      profilePicture: createAvatar(avatarStyle as Parameters<typeof createAvatar>[0], {
        seed: userName
      }).toDataUri(),
      emailVerifiedAt: createdAt,
      createdAt,
      updatedAt: createdAt
    }
  })

  const gameWeights = games.map(g => g.totalRatingCount ?? 1)
  const endlessByGame = new Map(
    games.map(g => [g.igdbId, IGDBService.suggestsEndless(g)])
  )

  const userGames: Prisma.UserGameCreateManyInput[] = []
  const stats: Prisma.UserGameStatsCreateManyInput[] = []
  const platformRows: Prisma.UserGamePlatformCreateManyInput[] = []
  const ratings: Prisma.RatingCreateManyInput[] = []
  const reviews: Prisma.ReviewCreateManyInput[] = []
  const usedTextsByGame = new Map<number, Set<string>>()

  for (const user of users) {
    const size = Math.min(
      games.length,
      12 + Math.floor(40 * rng.next() ** 1.4)
    )
    const library: Game[] = rng.weightedSample(games, gameWeights, size)

    for (const game of library) {
      const statusId = rng.weightedPick(STATUS_IDS, STATUS_WEIGHTS)
      const endless = endlessByGame.get(game.igdbId) ?? false
      const base = statsFor(statusId)

      const earliest = Math.max(
        user.createdAt.getTime(),
        (game.releaseDate ?? 0) * 1000
      )
      const addedAt = new Date(earliest + rng.next() * (now - earliest))
      const hasExperience = base.hours > 0 || base.completions > 0
      const completedAt =
        base.completions > 0
          ? new Date(addedAt.getTime() + rng.next() * (now - addedAt.getTime()))
          : null

      let hours = base.hours
      let completions = base.completions
      const userGameId = crypto.randomUUID()

      if (statusId !== WISHLIST && hasExperience && rng.chance(0.35)) {
        const split = splitAcrossPlatforms(hours, completions, completedAt)
        hours = split.totalHours
        completions = split.totalCompletions
        for (const row of split.rows) {
          platformRows.push({
            userGameId,
            platform: row.platform,
            hoursPlayed: row.hours,
            completions: row.completions,
            completedAt: row.completedAt,
            createdAt: addedAt,
            updatedAt: addedAt
          })
        }
      }

      userGames.push({
        id: userGameId,
        userId: user.id,
        igdbId: game.igdbId,
        userGamesStatusId: statusId,
        endless,
        completedAt,
        createdAt: addedAt,
        updatedAt: addedAt
      })
      stats.push({ userGameId, hoursPlayed: hours, completions })

      const rated =
        statusId !== WISHLIST &&
        (statusId === BACKLOG
          ? hasExperience && rng.chance(0.6)
          : rng.chance(statusId === PLAYED ? 0.9 : 0.55))
      if (!rated) continue

      const value = rng.weightedPick(
        RATING_VALUES,
        statusId === DROPPED ? DROPPED_RATING_WEIGHTS : RATING_WEIGHTS
      )
      const ratedAt = new Date(addedAt.getTime() + rng.next() * (now - addedAt.getTime()))
      ratings.push({
        userId: user.id,
        igdbId: game.igdbId,
        value,
        createdAt: ratedAt,
        updatedAt: ratedAt
      })

      const reviewable =
        REVIEWABLE.includes(statusId) || (statusId === BACKLOG && hasExperience)
      if (!reviewable || !rng.chance(statusId === PLAYED ? 0.65 : 0.4)) continue

      const used = usedTextsByGame.get(game.igdbId) ?? new Set<string>()
      usedTextsByGame.set(game.igdbId, used)
      const reviewedAt = new Date(ratedAt.getTime() + rng.next() * (now - ratedAt.getTime()))
      reviews.push({
        userId: user.id,
        igdbId: game.igdbId,
        text: pickReviewText(value, game.name, used, completions === 0),
        createdAt: reviewedAt,
        updatedAt: reviewedAt
      })
    }
  }

  const popularity = users.map((_, i) => 1 / (i + 1) ** 0.8)
  const shuffledPopularity = rng.weightedSample(
    popularity.map((_, i) => i),
    popularity,
    users.length
  )
  const weightByUser = new Map(
    shuffledPopularity.map((userIndex, rank) => [userIndex, 1 / (rank + 1) ** 0.8])
  )

  const follows: Prisma.FollowCreateManyInput[] = []
  users.forEach((follower, followerIndex) => {
    const others = users
      .map((u, index) => ({ u, index }))
      .filter(({ index }) => index !== followerIndex)
    const targets = rng.weightedSample(
      others,
      others.map(({ index }) => weightByUser.get(index) ?? 1),
      rng.between(5, 25)
    )
    for (const { u: following } of targets) {
      const earliest = Math.max(
        follower.createdAt.getTime(),
        following.createdAt.getTime()
      )
      follows.push({
        followerId: follower.id,
        followingId: following.id,
        createdAt: new Date(earliest + rng.next() * (now - earliest))
      })
    }
  })

  if (FOLLOW_EMAIL) {
    const real = await prisma.user.findUnique({
      where: { email: FOLLOW_EMAIL },
      select: { id: true }
    })
    if (real) {
      const mostFollowed = [...weightByUser.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
      for (const [userIndex] of mostFollowed) {
        follows.push({
          followerId: real.id,
          followingId: users[userIndex].id,
          createdAt: new Date(now - rng.between(1, 30) * DAY_MS)
        })
      }
    } else {
      console.warn(`SEED_DEMO_FOLLOW_EMAIL ${FOLLOW_EMAIL} not found; skipping.`)
    }
  }

  await insertInBatches(users, data => prisma.user.createMany({ data }))
  await insertInBatches(userGames, data =>
    prisma.userGame.createMany({ data })
  )
  await insertInBatches(stats, data =>
    prisma.userGameStats.createMany({ data })
  )
  await insertInBatches(platformRows, data =>
    prisma.userGamePlatform.createMany({ data })
  )
  await insertInBatches(ratings, data => prisma.rating.createMany({ data }))
  await insertInBatches(reviews, data => prisma.review.createMany({ data }))
  await insertInBatches(follows, data => prisma.follow.createMany({ data }))

  await validate()
  await summarize()
}

async function count(sql: Prisma.Sql) {
  const [row] = await prisma.$queryRaw<{ n: bigint }[]>(sql)
  return Number(row.n)
}

async function validate() {
  const demo = Prisma.sql`u.email LIKE ${EMAIL_PREFIX + '%' + EMAIL_DOMAIN}`
  const checks: [string, Prisma.Sql][] = [
    [
      'rating on a wishlist game',
      Prisma.sql`SELECT COUNT(*) AS n FROM ratings r JOIN users u ON u.id = r.user_id JOIN user_games ug ON ug.user_id = r.user_id AND ug.igdb_id = r.igdb_id WHERE ${demo} AND ug.user_games_status_id = ${WISHLIST}`
    ],
    [
      'review on a wishlist game or a backlog game without hours or completions',
      Prisma.sql`SELECT COUNT(*) AS n FROM reviews rv JOIN users u ON u.id = rv.user_id JOIN user_games ug ON ug.user_id = rv.user_id AND ug.igdb_id = rv.igdb_id LEFT JOIN user_game_stats s ON s.user_game_id = ug.id WHERE ${demo} AND (ug.user_games_status_id = ${WISHLIST} OR (ug.user_games_status_id = ${BACKLOG} AND COALESCE(s.hours_played, 0) = 0 AND COALESCE(s.completions, 0) = 0))`
    ],
    [
      'review without a library entry',
      Prisma.sql`SELECT COUNT(*) AS n FROM reviews rv JOIN users u ON u.id = rv.user_id LEFT JOIN user_games ug ON ug.user_id = rv.user_id AND ug.igdb_id = rv.igdb_id WHERE ${demo} AND ug.id IS NULL`
    ],
    [
      'rating or review on an unreleased game',
      Prisma.sql`SELECT COUNT(*) AS n FROM reviews rv JOIN users u ON u.id = rv.user_id JOIN games_cache g ON g.igdb_id = rv.igdb_id WHERE ${demo} AND g.release_date > EXTRACT(EPOCH FROM NOW())`
    ],
    [
      'stats different from the sum of the platforms',
      Prisma.sql`SELECT COUNT(*) AS n FROM user_game_stats s JOIN user_games ug ON ug.id = s.user_game_id JOIN users u ON u.id = ug.user_id WHERE ${demo} AND EXISTS (SELECT 1 FROM user_game_platforms p WHERE p.user_game_id = ug.id) AND (s.completions <> (SELECT COALESCE(SUM(p.completions), 0) FROM user_game_platforms p WHERE p.user_game_id = ug.id) OR ABS(COALESCE(s.hours_played, 0) - (SELECT COALESCE(SUM(p.hours_played), 0) FROM user_game_platforms p WHERE p.user_game_id = ug.id)) > 0.001)`
    ],
    [
      'endless game in PLAYING with a completion',
      Prisma.sql`SELECT COUNT(*) AS n FROM user_game_stats s JOIN user_games ug ON ug.id = s.user_game_id JOIN users u ON u.id = ug.user_id WHERE ${demo} AND ug.endless AND ug.user_games_status_id = ${PLAYING} AND s.completions > 0`
    ]
  ]

  for (const [label, sql] of checks) {
    const n = await count(sql)
    if (n > 0) throw new Error(`Validation failed: ${n} rows with ${label}.`)
  }
  console.log('Validation passed.')
}

async function summarize() {
  const demo = Prisma.sql`u.email LIKE ${EMAIL_PREFIX + '%' + EMAIL_DOMAIN}`
  const byStatus = await prisma.$queryRaw<{ status: string; n: bigint }[]>(
    Prisma.sql`SELECT ugs.status::text AS status, COUNT(*) AS n FROM user_games ug JOIN users u ON u.id = ug.user_id JOIN users_games_status ugs ON ugs.id = ug.user_games_status_id WHERE ${demo} GROUP BY 1 ORDER BY 2 DESC`
  )
  const paged = await count(
    Prisma.sql`SELECT COUNT(*) AS n FROM (SELECT rv.igdb_id FROM reviews rv JOIN users u ON u.id = rv.user_id WHERE ${demo} GROUP BY 1 HAVING COUNT(*) > 10) t`
  )

  console.log(
    `\nUsers: ${await count(Prisma.sql`SELECT COUNT(*) AS n FROM users u WHERE ${demo}`)}`
  )
  console.log(
    `Library rows: ${await count(Prisma.sql`SELECT COUNT(*) AS n FROM user_games ug JOIN users u ON u.id = ug.user_id WHERE ${demo}`)}`
  )
  for (const row of byStatus) console.log(`  ${row.status}: ${Number(row.n)}`)
  console.log(
    `Ratings: ${await count(Prisma.sql`SELECT COUNT(*) AS n FROM ratings r JOIN users u ON u.id = r.user_id WHERE ${demo}`)}`
  )
  console.log(
    `Reviews: ${await count(Prisma.sql`SELECT COUNT(*) AS n FROM reviews rv JOIN users u ON u.id = rv.user_id WHERE ${demo}`)}`
  )
  console.log(`Games with more than 10 reviews (second page): ${paged}`)
  console.log(
    `Follows: ${await count(Prisma.sql`SELECT COUNT(*) AS n FROM follows f JOIN users u ON u.id = f.follower_id WHERE ${demo}`)}`
  )
  console.log('\nRemove with: npm run seed:demo -- --clean')
}

main()
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
