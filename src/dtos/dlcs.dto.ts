export interface CreateDlcDTO {
  categories: { categoryName: string }[]
  dlcBanner: string
  dlcName: string
  gameStudios: { studioName: string }[]
  platforms: { platformName: string }[]
  publishers: { publisherName: string }[]
  summary: string
}
