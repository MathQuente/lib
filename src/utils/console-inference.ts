import { Console, Platform } from '@prisma/client'
import { CONSOLES_BY_PLATFORM } from './platform-consoles'

export const STEAM_CONSOLE: Console = 'PC'

const XBOX_CONSOLE_BY_DEVICE: Record<string, Console> = {
  Xbox360: 'XBOX_360',
  XboxOne: 'XBOX_ONE',
  XboxSeries: 'XBOX_SERIES'
}

const PSN_CONSOLE_BY_CATEGORY: Record<string, Console> = {
  ps4_game: 'PS4',
  ps5_native_game: 'PS5'
}

export function consoleFromXboxDevices(devices: string[]): Console {
  const consoles = new Set<Console>()
  for (const device of devices) {
    const found = XBOX_CONSOLE_BY_DEVICE[device]
    if (found) consoles.add(found)
  }
  if (consoles.size === 1) return [...consoles][0]
  if (consoles.size === 0 && devices.includes('PC')) return 'PC'
  return 'UNKNOWN'
}

export function consoleFromPsnCategories(categories: string[]): Console {
  const consoles = new Set<Console>()
  let hasUnknownCategory = false
  for (const category of categories) {
    const found = PSN_CONSOLE_BY_CATEGORY[category]
    if (found) consoles.add(found)
    else hasUnknownCategory = true
  }
  return consoles.size === 1 && !hasUnknownCategory
    ? [...consoles][0]
    : 'UNKNOWN'
}

const CONSOLE_BY_IGDB_NAME: Record<string, Console> = {
  playstation: 'PS1',
  'playstation 2': 'PS2',
  'playstation 3': 'PS3',
  'playstation 4': 'PS4',
  'playstation 5': 'PS5',
  'playstation portable': 'PSP',
  'playstation vita': 'PS_VITA',
  xbox: 'XBOX_ORIGINAL',
  'xbox 360': 'XBOX_360',
  'xbox one': 'XBOX_ONE',
  'xbox series x|s': 'XBOX_SERIES',
  'nintendo entertainment system': 'NES',
  'super nintendo entertainment system': 'SNES',
  'nintendo 64': 'N64',
  'nintendo gamecube': 'GAMECUBE',
  wii: 'WII',
  'wii u': 'WII_U',
  'nintendo switch': 'SWITCH',
  'nintendo switch 2': 'SWITCH_2',
  'game boy': 'GAME_BOY',
  'game boy color': 'GAME_BOY_COLOR',
  'game boy advance': 'GAME_BOY_ADVANCE',
  'nintendo ds': 'DS',
  'nintendo dsi': 'DS',
  'nintendo 3ds': 'N3DS',
  'new nintendo 3ds': 'N3DS',
  'pc (microsoft windows)': 'PC',
  mac: 'PC',
  linux: 'PC',
  'sega master system/mark iii': 'MASTER_SYSTEM',
  'sega mega drive/genesis': 'MEGA_DRIVE',
  'sega cd': 'SEGA_CD',
  'sega saturn': 'SATURN',
  dreamcast: 'DREAMCAST',
  'sega game gear': 'GAME_GEAR',
  'atari 2600': 'ATARI_2600',
  'atari 7800': 'ATARI_7800',
  android: 'MOBILE',
  ios: 'MOBILE',
  arcade: 'ARCADE'
}

const SUCCESSOR: Partial<Record<Console, Console>> = {
  PS1: 'PS2',
  PS2: 'PS3',
  PSP: 'PS_VITA',
  PS4: 'PS5',
  XBOX_ORIGINAL: 'XBOX_360',
  XBOX_360: 'XBOX_ONE',
  XBOX_ONE: 'XBOX_SERIES',
  GAME_BOY: 'GAME_BOY_ADVANCE',
  GAME_BOY_COLOR: 'GAME_BOY_ADVANCE',
  GAMECUBE: 'WII',
  WII: 'WII_U',
  DS: 'N3DS',
  SWITCH: 'SWITCH_2',
  PC: 'STEAM_DECK'
}

function consoleFromIgdbName(name: string): Console | undefined {
  const normalized = name.trim().toLowerCase()
  if (normalized in CONSOLE_BY_IGDB_NAME)
    return CONSOLE_BY_IGDB_NAME[normalized]
  if (normalized.startsWith('neo geo')) return 'NEO_GEO'
  if (normalized.startsWith('turbografx') || normalized.includes('pc engine')) {
    return 'TURBOGRAFX'
  }
  return undefined
}

export type BackfillSkipReason =
  'no-data' | 'none-in-ecosystem' | 'ambiguous' | 'has-successor'

export type ConsoleGuess = { console: Console } | { skip: BackfillSkipReason }

export function inferConsoleFromIgdbPlatforms(
  platform: Platform,
  igdbPlatformNames: string[] | null | undefined
): ConsoleGuess {
  if (!igdbPlatformNames || igdbPlatformNames.length === 0) {
    return { skip: 'no-data' }
  }

  const allowed: Console[] = CONSOLES_BY_PLATFORM[platform].filter(
    c => c !== 'UNKNOWN'
  )
  const found = new Set<Console>()
  for (const name of igdbPlatformNames) {
    const value = consoleFromIgdbName(name)
    if (value && allowed.includes(value)) found.add(value)
  }

  if (platform === 'XBOX' && found.size > 1) found.delete('PC')

  if (found.size === 0) return { skip: 'none-in-ecosystem' }
  if (found.size > 1) return { skip: 'ambiguous' }

  const [only] = found
  const successor = SUCCESSOR[only]
  if (successor && allowed.includes(successor)) return { skip: 'has-successor' }
  return { console: only }
}

export interface BackfillRow {
  id: string
  userGameId: string
  platform: Platform
  igdbPlatformNames: string[] | null
  siblingConsoles: Console[]
}

export interface BackfillUpdate {
  id: string
  userGameId: string
  platform: Platform
  to: Console
}

export type BackfillSkip = BackfillSkipReason | 'conflict'

export function planConsoleBackfill(rows: BackfillRow[]) {
  const updates: BackfillUpdate[] = []
  const skipped: Record<BackfillSkip, number> = {
    'no-data': 0,
    'none-in-ecosystem': 0,
    ambiguous: 0,
    'has-successor': 0,
    conflict: 0
  }

  for (const row of rows) {
    const guess = inferConsoleFromIgdbPlatforms(
      row.platform,
      row.igdbPlatformNames
    )
    if ('skip' in guess) {
      skipped[guess.skip]++
      continue
    }
    if (row.siblingConsoles.includes(guess.console)) {
      skipped.conflict++
      continue
    }
    updates.push({
      id: row.id,
      userGameId: row.userGameId,
      platform: row.platform,
      to: guess.console
    })
  }

  return { updates, skipped }
}
