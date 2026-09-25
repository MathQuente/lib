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
  game_modes?: { name: string }[]
  first_release_date?: number
  category?: number
  game_type?: number
  parent_game?: number | { id: number; name: string; cover?: { url: string } }
  rating?: number
  follows?: number
  hypes?: number
  total_rating_count?: number
  similar_games?: number[]
  involved_companies?: IGDBInvolvedCompany[]
  release_dates?: { date?: number; platform?: { name: string } }[]
  screenshots?: { image_id: string; width?: number; height?: number }[]
  videos?: { video_id: string; name?: string }[]
}
