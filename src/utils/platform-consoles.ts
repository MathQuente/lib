import { Console, Platform } from '@prisma/client'

const PLAYSTATION: Console[] = [
  'PS1',
  'PS2',
  'PS3',
  'PS4',
  'PS5',
  'PSP',
  'PS_VITA'
]
const XBOX: Console[] = [
  'XBOX_ORIGINAL',
  'XBOX_360',
  'XBOX_ONE',
  'XBOX_SERIES',
  'PC'
]
const NINTENDO: Console[] = [
  'NES',
  'SNES',
  'N64',
  'GAMECUBE',
  'WII',
  'WII_U',
  'SWITCH',
  'SWITCH_2',
  'GAME_BOY',
  'GAME_BOY_COLOR',
  'GAME_BOY_ADVANCE',
  'DS',
  'N3DS'
]

export const CONSOLES_BY_PLATFORM: Record<Platform, readonly Console[]> = {
  STEAM: ['UNKNOWN', 'PC', 'STEAM_DECK'],
  PLAYSTATION: ['UNKNOWN', ...PLAYSTATION],
  XBOX: ['UNKNOWN', ...XBOX],
  NINTENDO: ['UNKNOWN', ...NINTENDO],
  EPIC: ['UNKNOWN', 'PC'],
  GOG: ['UNKNOWN', 'PC'],
  OTHER: Object.values(Console)
}

export function isConsoleAllowed(platform: Platform, value: Console) {
  return CONSOLES_BY_PLATFORM[platform].includes(value)
}
