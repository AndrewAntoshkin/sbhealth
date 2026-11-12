/**
 * Builds a phone-sized GLB from the HuBMAP / HRA united male reference.
 * Source is CC BY 4.0 and is not committed; only the simplified derivative is.
 *
 *   node --max-old-space-size=8192 scripts/prepare-anatomy.mjs
 *   node --max-old-space-size=8192 scripts/prepare-anatomy.mjs --from-filtered
 */
import { mkdirSync, statSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, flatten, prune, quantize, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

const SRC = '/tmp/3d-vh-m-united.glb'
const FILTERED = '/tmp/anatomy-filtered.glb'
const OUT = resolve('public/models/anatomy.glb')

const BUDGET = {
  integumentary: 42000,
  nervous: 22000,
  sensory: 7000,
  endocrine: 5000,
  cardiovascular: 16000,
  respiratory: 12000,
  digestive: 16000,
  urinary: 9000,
  reproductive: 6000,
  immune: 4000,
  lymphatic: 4000,
  musculoskeletal: 18000,
  hematopoietic: 5000,
}

const ERROR = {
  integumentary: 0.008,
  nervous: 0.025,
  sensory: 0.02,
  endocrine: 0.03,
  cardiovascular: 0.025,
  respiratory: 0.025,
  digestive: 0.025,
  urinary: 0.025,
  reproductive: 0.04,
  immune: 0.04,
  lymphatic: 0.04,
  musculoskeletal: 0.018,
  hematopoietic: 0.03,
}

const BRAIN_KEEP = [
  'white_matter',
  'gyrus',
  'cerebell',
  'thalamus',
  'precuneus',
  'cuneus',
  'lobule',
  'corpus_callosum',
  'vermis',
  'brainstem',
  'medulla',
  'pons',
  'midbrain',
]

function classify(selfName, ancestors) {
  const n = (selfName || '').toLowerCase()
  const a = ancestors.map((name) => (name || '').toLowerCase())
  const has = (token) => n.includes(token) || a.some((name) => name.includes(token))

  if (n.includes('yao_') || a.some((name) => name.includes('yao_'))) return null
  if (n.includes('adipose') || n.includes('omentum')) return null
  if (
    n.includes('mouth') ||
    n.includes('tongue') ||
    n.includes('gingiva') ||
    n.includes('gums') ||
    n.includes('palate') ||
    n.includes('teeth') ||
    n.includes('tooth') ||
    a.some((name) => name.includes('mouth'))
  ) {
    return null
  }

  if (a.some((name) => name.includes('muscular_system'))) return null

  const sensory =
    !n.includes('ligament') &&
    !n.includes('junction') &&
    (['sclera', 'cornea', 'iris', 'pupil'].some((token) => n.includes(token)) ||
      /(?:^|_)lens(?:_|$)/.test(n))
  if (sensory) return 'sensory'

  if (
    n.includes('eye') ||
    n.includes('ocular') ||
    n.includes('ciliary') ||
    n.includes('vitreous') ||
    n.includes('retina') ||
    n.includes('choroid') ||
    n.includes('conjunctiva') ||
    n.includes('schlemm') ||
    n.includes('trabecular') ||
    a.some((name) => name.includes('_eye') || name.endsWith('eyes') || name.includes('ocular'))
  ) {
    return null
  }

  if (n.includes('hypothalamus') || n.includes('pineal') || n.includes('pituitary') || n.includes('pancreas')) {
    return 'endocrine'
  }
  if (n.includes('thymus') || n.includes('tonsil')) return 'immune'
  if (n.includes('spleen')) return 'lymphatic'
  if (n.includes('spongy') || n.includes('marrow')) return 'hematopoietic'

  if (n.startsWith('allen_') || a.some((name) => name.includes('allen_brain'))) {
    if (BRAIN_KEEP.some((token) => n.includes(token))) return 'nervous'
    return null
  }

  if (has('spinal_cord')) return 'nervous'
  if (
    has('circulatory_system') ||
    n.includes('heart') ||
    n.includes('aorta') ||
    n.includes('vena_cava') ||
    n.includes('vasculature') ||
    n.includes('artery') ||
    n.includes('vein')
  ) {
    return 'cardiovascular'
  }
  if (
    has('respiratory_system') ||
    n.includes('lung') ||
    n.includes('trachea') ||
    n.includes('bronch') ||
    n.includes('larynx')
  ) {
    return 'respiratory'
  }
  if (
    has('urinary_system') ||
    n.includes('kidney') ||
    n.includes('bladder') ||
    n.includes('ureter') ||
    n.includes('urethra')
  ) {
    return 'urinary'
  }
  if (has('reproductive') || n.includes('prostate') || n.includes('genital') || n.includes('vas_deferens')) {
    return 'reproductive'
  }
  if (
    has('digestive_system') ||
    n.includes('liver') ||
    n.includes('colon') ||
    n.includes('intestine') ||
    n.includes('gallbladder') ||
    n.includes('biliary')
  ) {
    return 'digestive'
  }
  if (n === 'vh_m_skin' || n.endsWith('_skin') || (has('integumentary_system') && n.includes('skin'))) {
    return 'integumentary'
  }
  if (
    has('skeletal_system') ||
    has('vertebral') ||
    n.includes('femur') ||
    n.includes('bone') ||
    n.includes('vertebra') ||
    n.includes('pelvis') ||
    n.includes('ilium') ||
    n.includes('ischium') ||
    n.includes('pubis') ||
    n.includes('hyoid')
  ) {
    return 'musculoskeletal'
  }
  return null
}

function triCount(mesh) {
  let total = 0
  for (const prim of mesh.listPrimitives()) {
    const indices = prim.getIndices()
    if (!indices) continue
    const mode = prim.getMode()
    if (mode && mode !== 4) continue
    total += indices.getCount() / 3
  }
  return total
}

function ancestorNames(node, parentOf) {
  const names = []
  let current = parentOf.get(node)
  while (current) {
    names.push(current.getName() || '')
    current = parentOf.get(current)
  }
  return names
}

function extentOf(accessor) {
  const array = accessor.getArray()
  let minX = Infinity
  let minY = Infinity
  let minZ = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  let maxZ = -Infinity
  for (let i = 0; i < array.length; i += 3) {
    const x = array[i]
    const y = array[i + 1]
    const z = array[i + 2]
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (z < minZ) minZ = z
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
    if (z > maxZ) maxZ = z
  }
  return Math.max(maxX - minX, maxY - minY, maxZ - minZ)
}

function compact(positions, indices) {
  const remap = new Map()
  const packed = []
  const next = new Uint32Array(indices.length)
  for (let i = 0; i < indices.length; i += 1) {
    const old = indices[i]
    let mapped = remap.get(old)
    if (mapped === undefined) {
      mapped = remap.size
      remap.set(old, mapped)
      packed.push(positions[old * 3], positions[old * 3 + 1], positions[old * 3 + 2])
    }
    next[i] = mapped
  }
  return { positions: new Float32Array(packed), indices: next }
}

function simplifyPrimitive(doc, prim, targetTris, errorLimit) {
  const indexAcc = prim.getIndices()
  const posAcc = prim.getAttribute('POSITION')
  if (!indexAcc || !posAcc) return { before: 0, after: 0 }
  const mode = prim.getMode()
  if (mode && mode !== 4) return { before: 0, after: 0 }

  const srcIndex = indexAcc.getArray()
  const positions = posAcc.getArray()
  const indices = srcIndex instanceof Uint32Array ? srcIndex : Uint32Array.from(srcIndex)
  const before = indices.length / 3
  let target = Math.max(36, Math.round(targetTris) * 3)
  if (target % 3 !== 0) target -= target % 3
  if (target >= indices.length) return { before, after: before }

  let [out, error] = MeshoptSimplifier.simplify(indices, positions, 3, target, errorLimit)
  if (out.length > target * 1.2) {
    const retry = MeshoptSimplifier.simplify(indices, positions, 3, target, 1)
    if (retry[0].length < out.length) {
      out = retry[0]
      error = retry[1]
    }
  }

  const packed = compact(positions, out)
  const indexOut = packed.positions.length / 3 > 65535 ? packed.indices : new Uint16Array(packed.indices)

  if (posAcc.listParents().length > 1) {
    const fresh = doc.createAccessor('POSITION')
    fresh.setType('VEC3')
    fresh.setArray(packed.positions)
    prim.setAttribute('POSITION', fresh)
  } else {
    posAcc.setArray(packed.positions)
  }

  if (indexAcc.listParents().length > 1) {
    const fresh = doc.createAccessor('INDEX')
    fresh.setType('SCALAR')
    fresh.setArray(indexOut)
    prim.setIndices(fresh)
  } else {
    indexAcc.setArray(indexOut)
  }

  for (const semantic of prim.listSemantics()) {
    if (semantic !== 'POSITION') prim.setAttribute(semantic, null)
  }

  const after = out.length / 3
  if (before > 4000 && after > targetTris * 1.4) {
    console.log(
      `  stuck before=${Math.round(before)} target=${Math.round(targetTris)} after=${Math.round(after)} error=${error.toFixed(4)}`,
    )
  }
  return { before, after, error }
}

function allocate(items, budget) {
  const total = items.reduce((sum, item) => sum + item.tris, 0)
  if (total <= budget) return items.map((item) => item.tris)
  const raw = items.map((item) => Math.max(120, (budget * item.tris) / total))
  const rawSum = raw.reduce((sum, value) => sum + value, 0)
  const scale = budget / rawSum
  return raw.map((value) => Math.max(120, Math.floor(value * scale)))
}

async function loadFiltered(io) {
  if (process.argv.includes('--from-filtered') && existsSync(FILTERED)) {
    console.log('reading filtered cache', FILTERED)
    return io.read(FILTERED)
  }

  console.time('read')
  const doc = await io.read(SRC)
  console.timeEnd('read')

  const parentOf = new Map()
  for (const node of doc.getRoot().listNodes()) {
    for (const child of node.listChildren()) parentOf.set(child, node)
  }

  const drop = []
  const kept = new Map()
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh()
    if (!mesh) continue
    const system = classify(node.getName() || '', ancestorNames(node, parentOf))
    if (!system) {
      drop.push(node)
      continue
    }
    node.setName(`${system}__${node.getName() || 'part'}`)
    kept.set(system, (kept.get(system) || 0) + 1)
  }
  for (const node of drop) node.dispose()
  console.log('kept nodes', Object.fromEntries([...kept.entries()].sort()))
  console.log('dropped mesh nodes', drop.length)

  console.time('flatten')
  await doc.transform(prune(), dedup(), flatten())
  try {
    await doc.transform(weld({ tolerance: 0.00015 }))
    console.log('welded')
  } catch (error) {
    console.warn('weld skipped', error instanceof Error ? error.message : error)
  }
  console.timeEnd('flatten')

  let exploded = 0
  for (const node of [...doc.getRoot().listNodes()]) {
    const mesh = node.getMesh()
    if (!mesh) continue
    let size = 0
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION')
      if (pos) size = Math.max(size, extentOf(pos))
    }
    if (size > 2.8) {
      console.log('drop exploded', size.toFixed(2), node.getName())
      node.dispose()
      exploded += 1
    }
  }
  console.log('exploded meshes', exploded)
  await doc.transform(prune())
  await io.write(FILTERED, doc)
  console.log('cached', FILTERED, `${(statSync(FILTERED).size / 1024 / 1024).toFixed(1)} MB`)
  return doc
}

async function connectVertices(doc) {
  const seen = new Set()
  const Q = 4096
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      for (const semantic of [...prim.listSemantics()]) {
        if (semantic !== 'POSITION') prim.setAttribute(semantic, null)
      }
      const accessor = prim.getAttribute('POSITION')
      if (!accessor || seen.has(accessor)) continue
      seen.add(accessor)
      const src = accessor.getArray()
      const dst = new Float32Array(src.length)
      for (let i = 0; i < src.length; i += 1) dst[i] = Math.round(src[i] * Q) / Q
      accessor.setArray(dst)
    }
  }
  await doc.transform(weld())
}

async function main() {
  if (!existsSync(SRC) && !process.argv.includes('--from-filtered')) {
    throw new Error(`Missing source model ${SRC}`)
  }
  await MeshoptSimplifier.ready
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
  const doc = await loadFiltered(io)
  console.time('connect')
  await connectVertices(doc)
  console.timeEnd('connect')

  const groups = new Map()
  for (const mesh of doc.getRoot().listMeshes()) {
    let system = null
    for (const parent of mesh.listParents()) {
      const name = parent.getName?.() || ''
      if (name.includes('__')) {
        system = name.split('__')[0]
        break
      }
    }
    if (!system || !BUDGET[system]) continue
    const tris = triCount(mesh)
    if (!groups.has(system)) groups.set(system, [])
    groups.get(system).push({ mesh, tris })
  }

  console.log('\nbefore simplify')
  for (const [system, items] of [...groups.entries()].sort()) {
    const tris = items.reduce((sum, item) => sum + item.tris, 0)
    console.log(`  ${system.padEnd(18)} ${String(items.length).padStart(4)} meshes  ${Math.round(tris).toLocaleString('en-US').padStart(10)} tris`)
  }
  if (!groups.has('integumentary')) {
    throw new Error('Skin mesh is missing. The body silhouette would be empty.')
  }

  console.time('simplify')
  for (const [system, items] of groups) {
    const targets = allocate(items, BUDGET[system])
    let after = 0
    console.log(`simplifying ${system} (${items.length})`)
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].tris > 80000) console.log(`  … ${Math.round(items[i].tris).toLocaleString('en-US')} tris`)
      for (const prim of items[i].mesh.listPrimitives()) {
        const share = items[i].tris > 0 ? triCountOfPrim(prim) / items[i].tris : 1
        try {
          const result = simplifyPrimitive(doc, prim, targets[i] * share, ERROR[system])
          after += result.after
        } catch (error) {
          console.warn(`  skip primitive in ${system}:`, error instanceof Error ? error.message : error)
          after += triCountOfPrim(prim)
        }
      }
    }
    console.log(`  ${system.padEnd(18)} -> ${Math.round(after).toLocaleString('en-US')} tris`)
  }
  console.timeEnd('simplify')

  await doc.transform(
    prune(),
    quantize({
      quantizePosition: 14,
      quantizeNormal: 10,
      quantizeTexcoord: 12,
    }),
  )

  mkdirSync(dirname(OUT), { recursive: true })
  await io.write(OUT, doc)
  const bytes = statSync(OUT).size
  console.log(`\nwrote ${OUT} ${(bytes / 1024 / 1024).toFixed(2)} MB`)
  if (bytes < 80_000) throw new Error('Output GLB looks empty')
}

function triCountOfPrim(prim) {
  const indices = prim.getIndices()
  if (!indices) return 0
  return indices.getCount() / 3
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
