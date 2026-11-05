import { describe, expect, it } from 'vitest'
import { recipes } from './catalog'
import { MAIN_BUCKET_LABEL, MAIN_BUCKET_ORDER, mainBucketsOf } from './mainIngredient'

function byTitle(title: string) {
  const r = recipes.find((x) => x.title === title)
  if (!r) throw new Error(`레시피 없음: ${title}`)
  return r
}

describe('주 재료 버킷', () => {
  it('보이는 레시피는 전부 최소 한 버킷에 들어간다', () => {
    const none = recipes.filter((r) => mainBucketsOf(r).length === 0).map((r) => r.title)
    expect(none).toEqual([])
  })

  it('버킷마다 레시피가 있고 라벨이 있다', () => {
    for (const b of MAIN_BUCKET_ORDER) {
      expect(MAIN_BUCKET_LABEL[b]).toBeTruthy()
      expect(recipes.some((r) => mainBucketsOf(r).includes(b))).toBe(true)
    }
  })

  it('대표 레시피가 기대한 버킷에 들어간다', () => {
    expect(mainBucketsOf(byTitle('김치찌개'))).toEqual(['pork', 'kimchi'])
    expect(mainBucketsOf(byTitle('제육볶음'))).toEqual(['pork'])
    expect(mainBucketsOf(byTitle('계란볶음밥'))).toEqual(['egg'])
    expect(mainBucketsOf(byTitle('감자조림'))).toEqual(['potato'])
    expect(mainBucketsOf(byTitle('토마토 파스타'))).toEqual(['noodle'])
    expect(mainBucketsOf(byTitle('어니언링'))).toEqual(['veg'])
    expect(mainBucketsOf(byTitle('멸치볶음'))).toEqual(['seafood'])
  })

  it('양파·대파 같은 흔한 재료만으로는 채소 버킷이 되지 않는다', () => {
    // 볶음밥류는 양파가 핵심이어도 '채소·버섯'으로 분류되면 안 된다.
    expect(mainBucketsOf(byTitle('계란볶음밥'))).not.toContain('veg')
  })
})
