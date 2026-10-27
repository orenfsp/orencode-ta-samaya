/*
 * QR-код без зависимостей: байтовый режим, уровень коррекции M, версии 1–15 (до ~410 байт —
 * ссылке на проверку справки хватает с запасом). Алгоритм — по стандарту ISO/IEC 18004,
 * в духе компактной реализации Nayuki: данные → коды Рида — Соломона → размещение → лучшая маска.
 */

// Индекс — версия. Уровень M: длина кода коррекции на блок и число блоков
const ECC_PER_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24]
const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10]
const MAX_VERSION = 15
const FORMAT_M = 0

const bit = (value: number, index: number) => ((value >>> index) & 1) !== 0

function rawModules(version: number) {
  let result = (16 * version + 128) * version + 64
  if (version >= 2) {
    const align = Math.floor(version / 7) + 2
    result -= (25 * align - 10) * align - 55
    if (version >= 7) result -= 36
  }
  return result
}

const dataCodewords = (version: number) =>
  Math.floor(rawModules(version) / 8) - ECC_PER_BLOCK[version]! * BLOCKS[version]!

function gfMultiply(x: number, y: number) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function rsDivisor(degree: number) {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j]!, root)
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function rsRemainder(data: number[], divisor: number[]) {
  const result = divisor.map(() => 0)
  for (const byte of data) {
    const factor = byte ^ result.shift()!
    result.push(0)
    divisor.forEach((coef, i) => (result[i]! ^= gfMultiply(coef, factor)))
  }
  return result
}

function alignmentPositions(version: number) {
  if (version === 1) return []
  const count = Math.floor(version / 7) + 2
  const step = Math.ceil((version * 4 + 4) / (count * 2 - 2)) * 2
  const result = [6]
  for (let pos = version * 4 + 17 - 7; result.length < count; pos -= step) result.splice(1, 0, pos)
  return result
}

/** Матрица модулей: true — тёмный. Бросает ошибку, если текст длиннее 15-й версии */
export function encodeQr(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  let version = 1
  for (; version <= MAX_VERSION; version++) {
    const countBits = version < 10 ? 8 : 16
    if (4 + countBits + bytes.length * 8 <= dataCodewords(version) * 8) break
  }
  if (version > MAX_VERSION) throw new Error('Слишком длинный текст для QR-кода')

  // Биты данных: режим «байты», длина, сами байты, терминатор и заполнители
  const bits: number[] = []
  const push = (value: number, length: number) => {
    for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, version < 10 ? 8 : 16)
  bytes.forEach((byte) => push(byte, 8))
  const capacity = dataCodewords(version) * 8
  push(0, Math.min(4, capacity - bits.length))
  push(0, (8 - (bits.length % 8)) % 8)
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8)
  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))

  // Блоки с кодами коррекции и чередование
  const blockCount = BLOCKS[version]!
  const eccLength = ECC_PER_BLOCK[version]!
  const rawCodewords = Math.floor(rawModules(version) / 8)
  const shortBlocks = blockCount - (rawCodewords % blockCount)
  const shortLength = Math.floor(rawCodewords / blockCount)
  const divisor = rsDivisor(eccLength)
  const blocks: number[][] = []
  for (let i = 0, k = 0; i < blockCount; i++) {
    const chunk = data.slice(k, k + shortLength - eccLength + (i < shortBlocks ? 0 : 1))
    k += chunk.length
    const ecc = rsRemainder(chunk, divisor)
    if (i < shortBlocks) chunk.push(0)
    blocks.push(chunk.concat(ecc))
  }
  const codewords: number[] = []
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLength - eccLength || j >= shortBlocks) codewords.push(block[i]!)
    })
  }

  // Служебные узоры
  const size = version * 4 + 17
  const modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const set = (x: number, y: number, dark: boolean) => {
    modules[y]![x] = dark
    reserved[y]![x] = true
  }
  for (let i = 0; i < size; i++) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }
  const finder = (cx: number, cy: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx
        const y = cy + dy
        const distance = Math.max(Math.abs(dx), Math.abs(dy))
        if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, distance !== 2 && distance !== 4)
      }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)
  const align = alignmentPositions(version)
  const last = align.length - 1
  align.forEach((ay, i) =>
    align.forEach((ax, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) return
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) set(ax + dx, ay + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }),
  )
  const drawFormat = (mask: number) => {
    const value = (FORMAT_M << 3) | mask
    let rem = value
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const format = ((value << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) set(8, i, bit(format, i))
    set(8, 7, bit(format, 6))
    set(8, 8, bit(format, 7))
    set(7, 8, bit(format, 8))
    for (let i = 9; i < 15; i++) set(14 - i, 8, bit(format, i))
    for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(format, i))
    for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(format, i))
    set(8, size - 8, true)
  }
  drawFormat(0)
  if (version >= 7) {
    let rem = version
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const value = (version << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      set(a, b, bit(value, i))
      set(b, a, bit(value, i))
    }
  }

  // Данные змейкой снизу вверх по парам столбцов
  let index = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++)
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!reserved[y]![x] && index < codewords.length * 8) {
          modules[y]![x] = bit(codewords[index >>> 3]!, 7 - (index & 7))
          index++
        }
      }
  }

  // Маска с наименьшим штрафом
  const masks: ((x: number, y: number) => boolean)[] = [
    (x, y) => (x + y) % 2 === 0,
    (_, y) => y % 2 === 0,
    (x) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
    (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
  ]
  const applyMask = (mask: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++)
        if (!reserved[y]![x] && masks[mask]!(x, y)) modules[y]![x] = !modules[y]![x]
  }
  let best = 0
  let bestScore = Infinity
  for (let mask = 0; mask < 8; mask++) {
    applyMask(mask)
    drawFormat(mask)
    const score = penalty(modules)
    if (score < bestScore) {
      best = mask
      bestScore = score
    }
    applyMask(mask)
  }
  applyMask(best)
  drawFormat(best)
  return modules
}

function penalty(modules: boolean[][]) {
  const size = modules.length
  let score = 0
  const finderLike = [true, false, true, true, true, false, true]
  const lines = [...modules, ...modules.map((_, x) => modules.map((row) => row[x]!))]
  for (const line of lines) {
    let run = 1
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    // Похожие на искатель куски со светлым полем с одной стороны
    for (let i = 0; i + 7 <= size; i++) {
      if (!finderLike.every((value, k) => line[i + k] === value)) continue
      const before = line.slice(Math.max(0, i - 4), i)
      const after = line.slice(i + 7, i + 11)
      if (i < 4 || before.every((v) => !v) || i + 11 > size || after.every((v) => !v)) score += 40
    }
  }
  for (let y = 0; y + 1 < size; y++)
    for (let x = 0; x + 1 < size; x++) {
      const c = modules[y]![x]
      if (c === modules[y]![x + 1] && c === modules[y + 1]![x] && c === modules[y + 1]![x + 1]) score += 3
    }
  const dark = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
  const total = size * size
  score += (Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10
  return score
}
