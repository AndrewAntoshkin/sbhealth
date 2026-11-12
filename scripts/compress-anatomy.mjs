/**
 * Сжимает public/models/anatomy.glb кодеком meshopt (EXT_meshopt_compression).
 * Браузер распаковывает его сам (drei/three подключают MeshoptDecoder), файл меньше примерно вдвое.
 *   node scripts/compress-anatomy.mjs [вход] [выход]
 */
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS, EXTMeshoptCompression } from '@gltf-transform/extensions'
import { meshopt } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptDecoder } from 'meshoptimizer'

const input = process.argv[2] ?? 'public/models/anatomy.glb'
const output = process.argv[3] ?? input

await MeshoptEncoder.ready
await MeshoptDecoder.ready

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

const doc = await io.read(input)
// уже квантованная геометрия: оставляем как есть, только упаковываем потоки
await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }))
doc.createExtension(EXTMeshoptCompression).setRequired(true)
await io.write(output, doc)
console.log('готово:', output)
