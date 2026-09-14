export type CommunityReviewRow = {
  userId: string
  userName: string | null
  profilePicture: string | null
  rating: number | null
  hoursPlayed: number
  completions: number
  text: string
  createdAt: Date
}
