export type CoverUrlChangeKind =
  | 'igual'
  | 'trocada_imagem'
  | 'trocada_formato'
  | 'ganha'
  | 'removida_ignorada'
  | 'url_invalida_ignorada'

export interface CoverUrlClassification {
  kind: CoverUrlChangeKind
  writes: boolean
  newCoverUrl: string | null
}

const COVER_HOST = 'images.igdb.com'
const IMAGE_EXTENSION = /\.(jpg|jpeg|png|webp)$/i

export function isValidCoverUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === COVER_HOST &&
      IMAGE_EXTENSION.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

export function coverImageId(url: string): string {
  const last = url.split('?')[0].split('/').pop() ?? ''
  return last.replace(IMAGE_EXTENSION, '')
}

export function classifyCoverUrlChange(input: {
  cacheCoverUrl: string | null
  igdbCoverUrl: string | null
}): CoverUrlClassification {
  const { cacheCoverUrl, igdbCoverUrl } = input

  if (cacheCoverUrl === igdbCoverUrl) {
    return { kind: 'igual', writes: false, newCoverUrl: cacheCoverUrl }
  }

  if (igdbCoverUrl === null) {
    return {
      kind: 'removida_ignorada',
      writes: false,
      newCoverUrl: cacheCoverUrl
    }
  }

  if (!isValidCoverUrl(igdbCoverUrl)) {
    return {
      kind: 'url_invalida_ignorada',
      writes: false,
      newCoverUrl: cacheCoverUrl
    }
  }

  if (cacheCoverUrl === null) {
    return { kind: 'ganha', writes: true, newCoverUrl: igdbCoverUrl }
  }

  return {
    kind:
      coverImageId(cacheCoverUrl) === coverImageId(igdbCoverUrl)
        ? 'trocada_formato'
        : 'trocada_imagem',
    writes: true,
    newCoverUrl: igdbCoverUrl
  }
}
