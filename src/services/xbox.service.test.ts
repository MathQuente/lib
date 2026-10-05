import { describe, it, expect, vi, afterEach } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  nameVariants,
  pickNameMatch,
  pickSubtitleMatch,
  runsOnTitleDevices,
  XboxService
} from './xbox.service'
import { XboxApiError, XboxApiService, XboxTitle } from './xbox-api.service'
import { IGDBService } from './igdb.service'
import { UserRepository } from '../repositories/users.repository'
import { GameCacheService } from './game-cache.service'
import { ClientError } from '../errors/client-error'
import { IGDBRequestError } from '../errors/igdb-request-error'
import { IGDBGame } from '../types/igdb'
import {
  fakePlatformService,
  FakePlatformRepository
} from '../test-utils/fake-platform-service'

const DAY_MS = 24 * 60 * 60 * 1000

function fakeUserRepository(
  overrides: Partial<UserRepository> = {}
): UserRepository {
  return {
    findUserById: vi.fn().mockResolvedValue({ id: 'user-1', xboxXuid: 'xuid-1' }),
    findUserGame: vi.fn().mockResolvedValue(null),
    addGameToUserLibrary: vi.fn().mockResolvedValue({ igdbId: 1 }),
    createUserGameStats: vi.fn().mockResolvedValue(null),
    upsertUserGameHours: vi.fn().mockResolvedValue(null),
    setXboxAccount: vi.fn().mockResolvedValue(null),
    ...overrides
  } as unknown as UserRepository
}

function fakeGameCacheService(): GameCacheService {
  return {
    cacheMany: vi.fn().mockResolvedValue(undefined)
  } as unknown as GameCacheService
}

function fakeXboxApi(overrides: Partial<XboxApiService> = {}): XboxApiService {
  return {
    findProfile: vi.fn(),
    getTitleHistory: vi.fn().mockResolvedValue([]),
    resolveProductIds: vi.fn().mockResolvedValue(new Map()),
    getMinutesPlayed: vi.fn().mockResolvedValue(new Map()),
    getUnlockedAchievements: vi.fn().mockResolvedValue([]),
    ...overrides
  } as unknown as XboxApiService
}

function title(overrides: Partial<XboxTitle>): XboxTitle {
  return {
    titleId: '1',
    name: 'Game',
    devices: ['XboxOne'],
    pfn: 'pfn-1',
    lastPlayedAt: new Date(Date.now() - 365 * DAY_MS),
    achievementProgress: 0,
    achievementsEarned: 0,
    achievementsTotal: 0,
    gamerscoreEarned: 0,
    gamerscoreTotal: 0,
    ...overrides
  }
}

function igdb(id: number, overrides: Partial<IGDBGame> = {}): IGDBGame {
  return { id, name: `Game ${id}`, ...overrides } as IGDBGame
}

function mockExternal(pairs: [string, number][]) {
  return vi
    .spyOn(IGDBService, 'getGamesByExternalIds')
    .mockResolvedValue(pairs.map(([uid, id]) => ({ uid, game: igdb(id) })))
}

function mockSearch(byName: Record<string, IGDBGame[]> = {}) {
  return vi
    .spyOn(IGDBService, 'searchGamesByName')
    .mockImplementation(async name => byName[name] ?? [])
}

let lastPlatformRepository: FakePlatformRepository

function makeService(
  userRepository: UserRepository,
  xboxApi: XboxApiService
): XboxService {
  const fake = fakePlatformService(userRepository)
  lastPlatformRepository = fake.platformRepository
  return new XboxService(
    userRepository,
    fakeGameCacheService(),
    xboxApi,
    fake.service,
    0
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('pickNameMatch', () => {
  it('returns null when no candidate has the same normalized name', () => {
    expect(
      pickNameMatch('The Witcher 2', [
        igdb(1, { name: 'The Witcher 2: Assassins of Kings' })
      ])
    ).toBeNull()
  })

  it('matches ignoring trademark symbols, case and punctuation', () => {
    const game = igdb(1, { name: 'Deus Ex: Human Revolution' })

    expect(pickNameMatch('DEUS EX: HUMAN REVOLUTION™', [game])).toBe(game)
  })

  it('matches through an alternative name', () => {
    const game = igdb(1, {
      name: 'Pro Evolution Soccer 2014',
      alternative_names: [{ name: 'PES 2014' }]
    })

    expect(pickNameMatch('PES 2014', [game])).toBe(game)
  })

  it('prefers the main name over an alternative name', () => {
    const main = igdb(2, { name: 'Fuse', first_release_date: 200 })
    const alternative = igdb(1, {
      name: 'Other',
      alternative_names: [{ name: 'Fuse' }],
      first_release_date: 100
    })

    expect(pickNameMatch('Fuse', [alternative, main])).toBe(main)
  })

  it('prefers the same spelling when punctuation would otherwise tie', () => {
    const plus = igdb(3, { name: 'N+', first_release_date: 300 })
    const plain = igdb(1, { name: 'N', first_release_date: 100 })

    expect(pickNameMatch('N+', [plain, plus])).toBe(plus)
  })

  it('prefers a standalone game with a cover over an older mod of the same name', () => {
    const mod = igdb(273136, {
      name: 'Battlefield 3',
      parent_game: 342,
      first_release_date: 100
    })
    const original = igdb(343, {
      name: 'Battlefield 3',
      cover: { url: '//cover.jpg' },
      first_release_date: 900
    })

    expect(pickNameMatch('Battlefield 3™', [mod, original])).toBe(original)
  })

  it('prefers the most rated game among standalone games with covers', () => {
    const remaster = igdb(1, {
      name: 'Sleeping Dogs',
      cover: { url: '//a.jpg' },
      total_rating_count: 50,
      first_release_date: 100
    })
    const original = igdb(2, {
      name: 'Sleeping Dogs',
      cover: { url: '//b.jpg' },
      total_rating_count: 900,
      first_release_date: 200
    })

    expect(pickNameMatch('Sleeping Dogs', [remaster, original])).toBe(original)
  })

  it('breaks remaining ties by the earliest release, then the lowest id', () => {
    const remaster = igdb(1, { name: 'Battlefield 3', first_release_date: 900 })
    const original = igdb(5, { name: 'Battlefield 3', first_release_date: 100 })
    const undated = igdb(2, { name: 'Battlefield 3' })

    expect(pickNameMatch('Battlefield 3™', [remaster, undated, original])).toBe(
      original
    )
    expect(pickNameMatch('Battlefield 3™', [igdb(9, { name: 'Battlefield 3' }), undated])).toBe(
      undated
    )
  })
})

describe('runsOnTitleDevices', () => {
  const on = (...names: string[]) =>
    igdb(1, { platforms: names.map(name => ({ name })) })

  it('rejects a game that never came out for the consoles the title runs on', () => {
    expect(
      runsOnTitleDevices(on('PC (Microsoft Windows)', 'Mac'), [
        'PC',
        'XboxOne',
        'XboxSeries'
      ])
    ).toBe(false)
  })

  it('accepts a game released for one of the title consoles', () => {
    expect(
      runsOnTitleDevices(on('PlayStation 4', 'Xbox One'), ['XboxOne', 'XboxSeries'])
    ).toBe(true)
    expect(
      runsOnTitleDevices(on('Xbox 360'), ['Xbox360', 'XboxOne'])
    ).toBe(true)
  })

  it('falls back to PC for PC-only titles', () => {
    expect(runsOnTitleDevices(on('PC (Microsoft Windows)'), ['PC'])).toBe(true)
    expect(runsOnTitleDevices(on('Xbox 360'), ['PC'])).toBe(false)
  })

  it('accepts when either side has no platform information', () => {
    expect(runsOnTitleDevices(igdb(1), ['XboxOne'])).toBe(true)
    expect(runsOnTitleDevices(on('Xbox One'), [])).toBe(true)
  })
})

describe('nameVariants', () => {
  it.each([
    ['COD: Black Ops II', ['Call of Duty: Black Ops II']],
    ['RE Revelations 2', ['Resident Evil Revelations 2']],
    ['OF: Dragon Rising', ['Operation Flashpoint: Dragon Rising']],
    ['EA SPORTS™ FIFA 16', ['FIFA 16']],
    [
      'EA SPORTS FC™ 25 Xbox Series X|S',
      ['EA SPORTS FC 25', 'FC 25']
    ],
    ['Halo 4', []],
    ['Minecraft: Xbox 360 Edition', []]
  ])('builds the alternative search names for %s', (name, expected) => {
    expect(nameVariants(name)).toEqual(expected)
  })
})

describe('pickSubtitleMatch', () => {
  it('accepts the only standalone game that adds a subtitle to the title', () => {
    const base = igdb(478, { name: 'The Witcher 2: Assassins of Kings' })

    expect(
      pickSubtitleMatch('The Witcher 2', [
        base,
        igdb(2, { name: 'The Witcher 2: Assassins of Kings - Enhanced Edition' }),
        igdb(3, { name: 'The Witcher 2: Other', parent_game: 478 }),
        igdb(4, { name: 'The Witcher 3: Wild Hunt' })
      ])
    ).toBe(base)
  })

  it('returns null when more than one game adds a subtitle', () => {
    expect(
      pickSubtitleMatch('Call of Duty', [
        igdb(1, { name: 'Call of Duty: Ghosts' }),
        igdb(2, { name: 'Call of Duty: WWII' })
      ])
    ).toBeNull()
  })
})

describe('XboxService.connectXbox', () => {
  const verifiedProfile = { xuid: '99', gamertag: 'Player' }

  it('saves the verified xuid and gamertag', async () => {
    const setXboxAccount = vi.fn().mockResolvedValue(null)
    const xboxApi = fakeXboxApi()
    const service = new XboxService(
      fakeUserRepository({ setXboxAccount }),
      fakeGameCacheService(),
      xboxApi
    )

    const result = await service.connectXbox('user-1', verifiedProfile)

    expect(setXboxAccount).toHaveBeenCalledWith('user-1', verifiedProfile)
    expect(result).toEqual({ xboxGamertag: 'Player' })
  })

  it('rejects with 409 when the profile is linked to another account', async () => {
    const setXboxAccount = vi.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('dup', {
        code: 'P2002',
        clientVersion: 'test'
      })
    )
    const service = new XboxService(
      fakeUserRepository({ setXboxAccount }),
      fakeGameCacheService(),
      fakeXboxApi()
    )

    await expect(
      service.connectXbox('user-1', verifiedProfile)
    ).rejects.toMatchObject({ statusCode: 409 })
  })

  it('rejects with 404 when the user does not exist', async () => {
    const service = new XboxService(
      fakeUserRepository({ findUserById: vi.fn().mockResolvedValue(null) }),
      fakeGameCacheService(),
      fakeXboxApi()
    )

    await expect(
      service.connectXbox('user-1', verifiedProfile)
    ).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('XboxService.disconnectXbox', () => {
  it('clears the linked account', async () => {
    const setXboxAccount = vi.fn().mockResolvedValue(null)
    const service = new XboxService(
      fakeUserRepository({ setXboxAccount }),
      fakeGameCacheService(),
      fakeXboxApi()
    )

    await service.disconnectXbox('user-1')

    expect(setXboxAccount).toHaveBeenCalledWith('user-1', null)
  })
})

describe('XboxService.runImport', () => {
  it('rejects with 400 when no Xbox profile is connected', async () => {
    const service = makeService(
      fakeUserRepository({
        findUserById: vi
          .fn()
          .mockResolvedValue({ id: 'user-1', xboxXuid: null })
      }),
      fakeXboxApi()
    )

    await expect(service.runImport('user-1')).rejects.toMatchObject({
      statusCode: 400
    })
  })

  it('imports titles matched by product id as XBOX platform rows without hours', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi
        .fn()
        .mockResolvedValue([title({ titleId: '1', pfn: 'pfn-1' })]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    const external = mockExternal([['9AAA', 10]])
    const search = mockSearch()
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)
    const onProgress = vi.fn()

    const result = await service.runImport('user-1', onProgress)

    expect(xboxApi.getTitleHistory).toHaveBeenCalledWith('xuid-1')
    expect(external).toHaveBeenCalledWith(
      ['9AAA'],
      IGDBService.XBOX_EXTERNAL_GAME_SOURCE
    )
    expect(search).not.toHaveBeenCalled()
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 10, userId: 'user-1', statusIds: 4 })
    )
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-10',
      'XBOX',
      { hoursPlayed: undefined, completions: 0, completedAt: null }
    )
    expect(result).toEqual({
      library: { imported: 1, updated: 0, skipped: 0, notFound: [] }
    })
    expect(onProgress).toHaveBeenLastCalledWith(100)
  })

  it('falls back to the IGDB name search for titles without a product match', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({ titleId: '1', name: 'Halo 4', pfn: null }),
        title({ titleId: '2', name: 'It Takes Two', pfn: 'pfn-2' }),
        title({ titleId: '3', name: 'Account Creation Tool', pfn: null })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-2', '9BBB']]))
    })
    mockExternal([])
    const search = mockSearch({
      'Halo 4': [igdb(991, { name: 'Halo 4' })],
      'It Takes Two': [igdb(135243, { name: 'It Takes Two' })],
      'Account Creation Tool': [igdb(5, { name: 'Something Else' })]
    })
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    const result = await service.runImport('user-1')

    expect(xboxApi.resolveProductIds).toHaveBeenCalledWith(['pfn-2'])
    expect(search).toHaveBeenCalledWith(
      'Halo 4',
      IGDBService.XBOX_SEARCH_PLATFORM_IDS
    )
    expect(result).toEqual({
      library: {
        imported: 2,
        updated: 0,
        skipped: 0,
        notFound: ['Account Creation Tool']
      }
    })
  })

  it('retries with an expanded name, then accepts a lone subtitle match', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({ titleId: '1', name: 'COD: Black Ops II', pfn: null }),
        title({ titleId: '2', name: 'The Witcher 2', pfn: null })
      ])
    })
    mockExternal([])
    const search = mockSearch({
      'Call of Duty: Black Ops II': [
        igdb(1122, { name: 'Call of Duty: Black Ops II' })
      ],
      'The Witcher 2': [igdb(478, { name: 'The Witcher 2: Assassins of Kings' })]
    })
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    const result = await service.runImport('user-1')

    expect(search).toHaveBeenCalledWith(
      'Call of Duty: Black Ops II',
      IGDBService.XBOX_SEARCH_PLATFORM_IDS
    )
    expect(result.library).toMatchObject({ imported: 2, notFound: [] })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 1122 })
    )
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ igdbId: 478 })
    )
  })

  it('counts a second title that resolves to the same IGDB game as skipped', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({ titleId: '1', name: 'Rise of the Tomb Raider', pfn: 'pfn-1' }),
        title({ titleId: '2', name: 'Rise of the Tomb Raider', pfn: null })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    mockExternal([['9AAA', 7323]])
    mockSearch({
      'Rise of the Tomb Raider': [igdb(7323, { name: 'Rise of the Tomb Raider' })]
    })
    const service = makeService(fakeUserRepository(), xboxApi)

    const result = await service.runImport('user-1')

    expect(result.library).toMatchObject({ imported: 1, skipped: 1 })
  })

  it('merges titles of the same IGDB game, keeping the best completion and latest play', async () => {
    const finishedAt = new Date('2016-06-27T00:00:00.000Z')
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({
          titleId: '1',
          pfn: 'pfn-one',
          achievementProgress: 2,
          lastPlayedAt: new Date(Date.now() - 2 * DAY_MS)
        }),
        title({
          titleId: '2',
          pfn: 'pfn-360',
          achievementProgress: 100,
          lastPlayedAt: finishedAt
        })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(
        new Map([
          ['pfn-one', '9AAA'],
          ['pfn-360', '9BBB']
        ])
      )
    })
    mockExternal([
      ['9AAA', 10],
      ['9BBB', 10]
    ])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    const result = await service.runImport('user-1')

    expect(result.library).toMatchObject({ imported: 1, skipped: 1 })
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledTimes(1)
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 1, completedAt: finishedAt })
    )
  })

  it('saves hours from minutes played, summing merged titles', async () => {
    const getMinutesPlayed = vi.fn().mockResolvedValue(
      new Map([
        ['1', 90],
        ['2', 45]
      ])
    )
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({ titleId: '1', pfn: 'pfn-one' }),
        title({ titleId: '2', pfn: 'pfn-360' }),
        title({ titleId: '3', pfn: 'pfn-other' })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(
        new Map([
          ['pfn-one', '9AAA'],
          ['pfn-360', '9BBB'],
          ['pfn-other', '9CCC']
        ])
      ),
      getMinutesPlayed
    })
    mockExternal([
      ['9AAA', 10],
      ['9BBB', 10],
      ['9CCC', 20]
    ])
    const service = makeService(fakeUserRepository(), xboxApi)

    await service.runImport('user-1')

    expect(getMinutesPlayed).toHaveBeenCalledWith('xuid-1', ['1', '2', '3'])
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-10',
      'XBOX',
      expect.objectContaining({ hoursPlayed: 2.25 })
    )
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-20',
      'XBOX',
      expect.objectContaining({ hoursPlayed: undefined })
    )
  })

  it('imports without hours when the minutes played lookup fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([title({})]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']])),
      getMinutesPlayed: vi.fn().mockRejectedValue(new XboxApiError('down', 500))
    })
    mockExternal([['9AAA', 10]])
    const service = makeService(fakeUserRepository(), xboxApi)

    const result = await service.runImport('user-1')

    expect(result.library.imported).toBe(1)
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-10',
      'XBOX',
      expect.objectContaining({ hoursPlayed: undefined })
    )
  })

  it('does not search IGDB for names with nothing left after normalizing', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi
        .fn()
        .mockResolvedValue([title({ name: '完美世界', pfn: null })])
    })
    mockExternal([])
    const search = mockSearch()
    const service = makeService(fakeUserRepository(), xboxApi)

    const result = await service.runImport('user-1')

    expect(search).not.toHaveBeenCalled()
    expect(result.library.notFound).toEqual(['完美世界'])
  })

  it('keeps importing when one name search fails upstream', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({ titleId: '1', name: 'Broken', pfn: null }),
        title({ titleId: '2', name: 'Halo 4', pfn: null })
      ])
    })
    mockExternal([])
    vi.spyOn(IGDBService, 'searchGamesByName').mockImplementation(
      async name => {
        if (name === 'Broken') throw new IGDBRequestError('bad query')
        return [igdb(991, { name: 'Halo 4' })]
      }
    )
    const service = makeService(fakeUserRepository(), xboxApi)

    const result = await service.runImport('user-1')

    expect(result.library).toMatchObject({ imported: 1, notFound: ['Broken'] })
  })

  it('marks a title with every achievement as played and completed', async () => {
    const lastPlayedAt = new Date('2025-01-10T00:00:00.000Z')
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi
        .fn()
        .mockResolvedValue([
          title({ achievementProgress: 100, lastPlayedAt })
        ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    mockExternal([['9AAA', 10]])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 1, completedAt: lastPlayedAt })
    )
    expect(lastPlatformRepository.savePlatform).toHaveBeenCalledWith(
      'ug-10',
      'XBOX',
      { hoursPlayed: undefined, completions: 1, completedAt: lastPlayedAt }
    )
  })

  it.each([
    [
      'the reported total says the share fits a game of that size',
      { achievementProgress: 42, achievementsEarned: 22, achievementsTotal: 50 },
      1
    ],
    [
      'Xbox omits the total and the gamerscore share fits the game size',
      {
        achievementProgress: 55,
        achievementsEarned: 40,
        gamerscoreEarned: 555,
        gamerscoreTotal: 1000
      },
      1
    ],
    [
      'DLC inflates the total gamerscore but the base game share is high',
      {
        achievementProgress: 16,
        achievementsEarned: 24,
        gamerscoreEarned: 655,
        gamerscoreTotal: 4000
      },
      1
    ],
    [
      'the gamerscore share is too small for a short achievement list',
      {
        achievementProgress: 57,
        achievementsEarned: 12,
        gamerscoreEarned: 580,
        gamerscoreTotal: 1000
      },
      4
    ],
    [
      'only a small share of achievements was earned',
      { achievementProgress: 10, achievementsEarned: 5, achievementsTotal: 50 },
      4
    ],
    [
      'no achievement was earned',
      { achievementProgress: 0, achievementsEarned: 0, achievementsTotal: 50 },
      4
    ]
  ])('infers completion below 100%% when %s', async (_name, progress, statusId) => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([title(progress)]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    mockExternal([['9AAA', 10]])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: statusId })
    )
  })

  it('does not infer completion for sports and racing games', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({
          achievementProgress: 57,
          achievementsEarned: 17,
          gamerscoreEarned: 575,
          gamerscoreTotal: 1000
        })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    vi.spyOn(IGDBService, 'getGamesByExternalIds').mockResolvedValue([
      { uid: '9AAA', game: igdb(10, { genres: [{ name: 'Sport' }] }) }
    ])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 4 })
    )
    expect(xboxApi.getUnlockedAchievements).not.toHaveBeenCalled()
  })

  it.each([
    [
      'the first achievement that describes the ending',
      [
        { description: 'Kill 500 monsters', unlockedAt: new Date('2017-08-05T00:00:00Z') },
        { description: 'Watch the credits', unlockedAt: new Date('2016-12-29T00:00:00Z') }
      ],
      new Date('2016-12-29T00:00:00Z')
    ],
    [
      'the last achievement earned when none describes the ending',
      [
        { description: 'Kill 500 monsters', unlockedAt: new Date('2017-08-05T00:00:00Z') },
        { description: 'Craft 5 items', unlockedAt: new Date('2016-12-28T00:00:00Z') }
      ],
      new Date('2017-08-05T00:00:00Z')
    ],
    ['the last played date when no unlock dates are known', [], new Date('2025-06-21T00:00:00Z')]
  ])('dates a finished title by %s', async (_name, achievements, expected) => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({
          achievementProgress: 100,
          lastPlayedAt: new Date('2025-06-21T00:00:00Z')
        })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']])),
      getUnlockedAchievements: vi.fn().mockResolvedValue(achievements)
    })
    mockExternal([['9AAA', 10]])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(xboxApi.getUnlockedAchievements).toHaveBeenCalledWith('xuid-1', '1')
    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 1, completedAt: expected })
    )
  })

  it('still imports a finished title when the achievement dates lookup fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const lastPlayedAt = new Date('2025-06-21T00:00:00Z')
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi
        .fn()
        .mockResolvedValue([title({ achievementProgress: 100, lastPlayedAt })]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']])),
      getUnlockedAchievements: vi
        .fn()
        .mockRejectedValue(new XboxApiError('rate limited', 429))
    })
    mockExternal([['9AAA', 10]])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 1, completedAt: lastPlayedAt })
    )
  })

  it('does not match a title by name to a game from another console generation', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({
          name: 'Call of Duty®',
          pfn: null,
          devices: ['PC', 'XboxOne', 'XboxSeries']
        })
      ])
    })
    mockExternal([])
    mockSearch({
      'Call of Duty®': [
        igdb(621, {
          name: 'Call of Duty',
          platforms: [{ name: 'PC (Microsoft Windows)' }, { name: 'Mac' }]
        })
      ]
    })
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    const result = await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).not.toHaveBeenCalled()
    expect(result.library.notFound).toEqual(['Call of Duty®'])
  })

  it('does not infer completion for multiplayer-only titles', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi.fn().mockResolvedValue([
        title({
          achievementProgress: 42,
          achievementsEarned: 22,
          achievementsTotal: 50
        })
      ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    vi.spyOn(IGDBService, 'getGamesByExternalIds').mockResolvedValue([
      {
        uid: '9AAA',
        game: igdb(10, {
          game_modes: [{ name: 'Multiplayer' }]
        } as Partial<IGDBGame>)
      }
    ])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 4 })
    )
  })

  it('marks a title played in the last 14 days as playing', async () => {
    const xboxApi = fakeXboxApi({
      getTitleHistory: vi
        .fn()
        .mockResolvedValue([
          title({ lastPlayedAt: new Date(Date.now() - 2 * DAY_MS) })
        ]),
      resolveProductIds: vi.fn().mockResolvedValue(new Map([['pfn-1', '9AAA']]))
    })
    mockExternal([['9AAA', 10]])
    const userRepository = fakeUserRepository()
    const service = makeService(userRepository, xboxApi)

    await service.runImport('user-1')

    expect(userRepository.addGameToUserLibrary).toHaveBeenCalledWith(
      expect.objectContaining({ statusIds: 3 })
    )
  })

  it.each([
    [undefined, 502, 'Xbox Live'],
    [500, 502, 'Xbox Live'],
    [403, 400, 'visível para todos']
  ])(
    'reports an upstream %s on the title history as %i mentioning "%s"',
    async (upstreamStatus, statusCode, text) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const service = makeService(
        fakeUserRepository(),
        fakeXboxApi({
          getTitleHistory: vi
            .fn()
            .mockRejectedValue(new XboxApiError('aborted', upstreamStatus))
        })
      )

      const error = await service.runImport('user-1').catch(e => e)

      expect(error).toBeInstanceOf(ClientError)
      expect(error.statusCode).toBe(statusCode)
      expect(error.message).toContain(text)
    }
  )

  it.each([
    [403, 400],
    [429, 503]
  ])(
    'hides an upstream %i on the title history behind a %i error',
    async (upstreamStatus, statusCode) => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const service = makeService(
        fakeUserRepository(),
        fakeXboxApi({
          getTitleHistory: vi
            .fn()
            .mockRejectedValue(new XboxApiError('raw upstream', upstreamStatus))
        })
      )

      const error = await service.runImport('user-1').catch(e => e)

      expect(error).toBeInstanceOf(ClientError)
      expect(error.statusCode).toBe(statusCode)
      expect(error.message).not.toContain('raw upstream')
    }
  )
})
