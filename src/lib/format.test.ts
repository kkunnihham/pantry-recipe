import { describe, expect, it } from 'vitest'
import { formatMinutes, formatTimer, scaleAmount, scaleWater } from './format'

describe('scaleAmount', () => {
  it('배수 1이면 원래 값을 그대로 보여준다', () => {
    expect(scaleAmount(1.5, '큰술', 1)).toBe('1.5큰술')
    expect(scaleAmount(37.5, 'g', 1)).toBe('37.5g')
    expect(scaleAmount(null, 'g', 1)).toBe('적당량')
  })
  it('무게·부피는 5 단위로 반올림하고 최소 5', () => {
    expect(scaleAmount(150, 'g', 0.25)).toBe('40g')
    expect(scaleAmount(1000, 'g', 0.25)).toBe('250g')
    expect(scaleAmount(3, 'g', 0.5)).toBe('5g')
    expect(scaleAmount(100, 'ml', 3)).toBe('300ml')
  })
  it('숟가락은 0.5 단위, 반 큰술 미만은 작은술로 바꾼다', () => {
    expect(scaleAmount(1, '큰술', 0.25)).toBe('1작은술')
    expect(scaleAmount(1.5, '큰술', 0.5)).toBe('1큰술')
    expect(scaleAmount(0.5, '작은술', 0.25)).toBe('0.5작은술')
    expect(scaleAmount(2, '큰술', 3)).toBe('6큰술')
  })
  it('개수 단위는 0.5 단위이고 꼬집은 1~2로 묶인다', () => {
    expect(scaleAmount(1, '개', 0.25)).toBe('0.5개')
    expect(scaleAmount(10, '개', 0.25)).toBe('2.5개')
    expect(scaleAmount(1, '꼬집', 3)).toBe('2꼬집')
    expect(scaleAmount(1, '꼬집', 0.25)).toBe('1꼬집')
  })
})

describe('scaleWater', () => {
  it('5ml 단위로 반올림한다', () => {
    expect(scaleWater(650, 0.25)).toBe('165ml')
    expect(scaleWater(450, 1)).toBe('450ml')
    expect(scaleWater(10, 0.25)).toBe('5ml')
  })
})

describe('formatMinutes / formatTimer', () => {
  it('분과 시간을 읽기 좋게 만든다', () => {
    expect(formatMinutes(45)).toBe('45분')
    expect(formatMinutes(60)).toBe('1시간')
    expect(formatMinutes(145)).toBe('2시간 25분')
    expect(formatTimer(90)).toBe('1분 30초')
    expect(formatTimer(40)).toBe('40초')
  })
})
