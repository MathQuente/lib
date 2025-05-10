export interface CreateUserDTO {
  email: string
  password: string
  userName?: string
}

export interface AddGameDTO {
  itemId: string
  userId: string
  statusIds: number[]
  type: 'game' | 'dlc'
}

export interface UpdateUserDTO {
  userName?: string | null
  profilePicture?: string | null
  userBanner?: string | null
}
