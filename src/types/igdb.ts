export interface IGDBInvolvedCompany {
  company: { name: string }
  developer: boolean
  publisher: boolean
}

export interface IGDBGame {
  id: number
  name: string
  summary?: string
  cover?: { url: string }
  genres?: { name: string }[]
  platforms?: { name: string }[]
  first_release_date?: number
  category?: number
  parent_game?: number
  rating?: number
  follows?: number
  hypes?: number
  total_rating_count?: number
  similar_games?: number[]
  involved_companies?: IGDBInvolvedCompany[]
}

export interface IGDBGameEnriched {
  igdbId: number
  name: string
  coverUrl: string | null
  summary?: string
  genres?: string[]
  platforms?: string[]
  releaseDate?: number
  rating?: number
  status?: string
}
