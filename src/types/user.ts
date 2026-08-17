import { Status } from '@prisma/client'

export type UserGameSortBy = 'gameName' | 'dateRelease' | 'rating'
export type UserGameSortOrder = 'asc' | 'desc'

export type PaginatedUserGameRow = {
  igdbId: number
  status: Status
  name: string | null
  coverUrl: string | null
  platforms: string[] | null
  releaseDate: number | null
  rating: number | null
}
