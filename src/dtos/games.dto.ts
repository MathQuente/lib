export interface CreateGameDTO {
  categories: { categoryName: string }[]
  gameBanner: string
  gameName: string
  gameStudios: { studioName: string }[]
  platforms: { platformName: string }[]
  publishers: { publisherName: string }[]
  summary: string
}

export interface UpdateGameDTO {
  categories?: { categoryName: string }[]
  gameBanner?: string
  gameName?: string
  gameStudios?: { studioName: string }[]
  platforms?: { platformName: string }[]
  publishers?: { publisherName: string }[]
  summary?: string
}
