export interface CreateGameDTO {
  categories: { categoryName: string }[]
  gameBanner: string
  gameName: string
  gameStudios: { studioName: string }[]
  platforms: { platformName: string }[]
  publishers: { publisherName: string }[]
  summary: string
  isDlc: boolean
  parentGameId?: string | null
}

export interface UpdateGameDTO {
  categories?: { categoryName: string }[]
  gameBanner?: string
  gameName?: string
  gameStudios?: { studioName: string }[]
  platforms?: { platformName: string }[]
  publishers?: { publisherName: string }[]
  summary?: string
  isDlc: boolean
  parentGameId?: string | null
}
