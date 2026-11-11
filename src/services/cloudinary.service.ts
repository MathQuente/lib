import { createHash } from 'crypto'
import { fetchWithTimeout } from '../utils/fetch-with-timeout'

const CLOUDINARY_HOST = 'res.cloudinary.com'
const DESTROY_TIMEOUT_MS = 5_000
const PUBLIC_ID_PREFIX = 'images/'
const VERSION_SEGMENT = /^v\d+$/

export class CloudinaryService {
  static isConfigured(): boolean {
    return Boolean(
      process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET
    )
  }

  static publicIdFromUrl(rawUrl: string): string | null {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    if (!cloudName) return null

    let url: URL
    try {
      url = new URL(rawUrl)
    } catch {
      return null
    }
    if (url.protocol !== 'https:' || url.hostname !== CLOUDINARY_HOST) {
      return null
    }

    const segments = url.pathname.split('/').filter(Boolean)
    if (segments[0] !== cloudName) return null
    if (segments[1] !== 'image' || segments[2] !== 'upload') return null

    const versionIndex = segments.findIndex(
      (segment, index) => index >= 3 && VERSION_SEGMENT.test(segment)
    )
    if (versionIndex < 0) return null
    const idSegments = segments.slice(versionIndex + 1)
    if (idSegments.length === 0) return null

    let decoded: string
    try {
      decoded = decodeURIComponent(idSegments.join('/'))
    } catch {
      return null
    }
    const withoutExtension = decoded.replace(/\.[A-Za-z0-9]+$/, '')
    return withoutExtension.startsWith(PUBLIC_ID_PREFIX)
      ? withoutExtension
      : null
  }

  static async destroy(publicId: string): Promise<void> {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME
    const apiKey = process.env.CLOUDINARY_API_KEY
    const apiSecret = process.env.CLOUDINARY_API_SECRET
    if (!cloudName || !apiKey || !apiSecret) return

    const timestamp = Math.floor(Date.now() / 1000)
    const signature = createHash('sha1')
      .update(
        `invalidate=true&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
      )
      .digest('hex')

    const body = new URLSearchParams({
      public_id: publicId,
      timestamp: String(timestamp),
      invalidate: 'true',
      api_key: apiKey,
      signature
    })

    const response = await fetchWithTimeout(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/destroy`,
      { method: 'POST', body },
      DESTROY_TIMEOUT_MS
    )
    if (!response.ok) {
      throw new Error(
        `Cloudinary destroy failed with status ${response.status}`
      )
    }
    const result = (await response.json()) as { result?: string }
    if (result.result !== 'ok') {
      throw new Error(
        `Cloudinary destroy returned ${result.result ?? 'no result'}`
      )
    }
  }
}
