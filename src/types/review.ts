export type ReviewAuthorStatus =
  | 'PLAYED'
  | 'PAUSED'
  | 'PLAYING'
  | 'BACKLOG'
  | 'WISHLIST'
  | 'DROPPED'

export type CommunityReviewRow = {
  userId: string
  userName: string | null
  profilePicture: string | null
  rating: number | null
  hoursPlayed: number
  completions: number
  status: ReviewAuthorStatus | null
  endless: boolean
  text: string
  createdAt: Date
}
