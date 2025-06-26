export interface CreateUserDTO {
  email: string
  password: string
  userName?: string
}

export interface AddGameDTO {
  gameId: string
  userId: string
  statusIds: number
}

export interface UpdateUserDTO {
  userName?: string | null
  profilePicture?: string | null
  userBanner?: string | null
}
