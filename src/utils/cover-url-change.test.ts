import { describe, it, expect } from 'vitest'
import {
  classifyCoverUrlChange,
  coverImageId,
  isValidCoverUrl
} from './cover-url-change'

const BASE = 'https://images.igdb.com/igdb/image/upload'
const OLD = `${BASE}/t_cover_big/coc7pg.jpg`
const NEW = `${BASE}/t_cover_big/cocv5r.jpg`

describe('isValidCoverUrl', () => {
  it.each([
    [NEW, true],
    [`${BASE}/t_cover_big/abc.png`, true],
    [
      'https:https://images.igdb.com/igdb/image/upload/t_cover_big/a.jpg',
      false
    ],
    ['http://images.igdb.com/igdb/image/upload/t_cover_big/a.jpg', false],
    ['https://example.com/igdb/image/upload/t_cover_big/a.jpg', false],
    [`${BASE}/t_cover_big/a`, false],
    ['', false],
    ['nao-e-url', false]
  ])('%s -> %s', (url, expected) => {
    expect(isValidCoverUrl(url)).toBe(expected)
  })
})

describe('coverImageId', () => {
  it('takes the last path segment without the extension', () => {
    expect(coverImageId(OLD)).toBe('coc7pg')
    expect(coverImageId(`${BASE}/t_thumb/coc7pg.jpg`)).toBe('coc7pg')
  })
})

describe('classifyCoverUrlChange', () => {
  it('does not write the same cover', () => {
    expect(
      classifyCoverUrlChange({ cacheCoverUrl: OLD, igdbCoverUrl: OLD })
    ).toEqual({ kind: 'igual', writes: false, newCoverUrl: OLD })
  })

  it('does not write anything when neither side has a cover', () => {
    expect(
      classifyCoverUrlChange({ cacheCoverUrl: null, igdbCoverUrl: null })
    ).toMatchObject({ kind: 'igual', writes: false })
  })

  it('writes a different image', () => {
    expect(
      classifyCoverUrlChange({ cacheCoverUrl: OLD, igdbCoverUrl: NEW })
    ).toEqual({ kind: 'trocada_imagem', writes: true, newCoverUrl: NEW })
  })

  it('tells a format-only change from an image change', () => {
    expect(
      classifyCoverUrlChange({
        cacheCoverUrl: `${BASE}/t_thumb/coc7pg.jpg`,
        igdbCoverUrl: OLD
      })
    ).toMatchObject({ kind: 'trocada_formato', writes: true })
  })

  it('fills in a missing cover', () => {
    expect(
      classifyCoverUrlChange({ cacheCoverUrl: null, igdbCoverUrl: NEW })
    ).toEqual({ kind: 'ganha', writes: true, newCoverUrl: NEW })
  })

  it('never turns an existing cover into NULL', () => {
    expect(
      classifyCoverUrlChange({ cacheCoverUrl: OLD, igdbCoverUrl: null })
    ).toEqual({ kind: 'removida_ignorada', writes: false, newCoverUrl: OLD })
  })

  it.each([
    'https:https://images.igdb.com/igdb/image/upload/t_cover_big/a.jpg',
    'https://cdn.example.com/a.jpg',
    'https://images.igdb.com/igdb/image/upload/t_cover_big/a'
  ])('ignores an invalid IGDB url (%s) before it can reach the backup', url => {
    expect(
      classifyCoverUrlChange({ cacheCoverUrl: OLD, igdbCoverUrl: url })
    ).toEqual({
      kind: 'url_invalida_ignorada',
      writes: false,
      newCoverUrl: OLD
    })
  })
})
