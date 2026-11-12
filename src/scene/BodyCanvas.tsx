import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { CameraControls, useGLTF, useProgress } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, type RefObject } from 'react'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type CameraControlsImpl from 'camera-controls'
import * as THREE from 'three'
import { MESH_COLOR, SYSTEMS, levelOf, type SystemId } from '../data/systems'

const MODEL_URL = `${import.meta.env.BASE_URL}models/anatomy.glb`
const DEFAULT_YAW = -0.42
const HOME_POS = new THREE.Vector3(0.18, 0.06, 3.95)
const HOME_TARGET = new THREE.Vector3(0, 0.02, 0)
const DIM = new THREE.Color('#d5dee3')
const SKIN_TINT = new THREE.Color('#f6e6dc')

useGLTF.preload(MODEL_URL)

interface Part {
  id: SystemId
  geometry: THREE.BufferGeometry
}

interface Props {
  selected: SystemId | null
  resetSignal: number
  /** Высота (px), которую шторка закрывает в свёрнутом виде. 0 — шторки нет. */
  peek: number
  /** Сколько px снизу сейчас закрыто шторкой. */
  inset: number
  onSelect: (id: SystemId | null) => void
}

const TAN_HALF_FOV = Math.tan((28 * Math.PI) / 360)
const BODY_HEIGHT = 1.86

function homeDistance(stageHeight: number, peek: number) {
  const visible = stageHeight > 0 ? Math.max(0.35, 1 - peek / stageHeight) : 1
  const view = BODY_HEIGHT / (0.9 * visible)
  return THREE.MathUtils.clamp(view / (2 * TAN_HALF_FOV), 3.9, 7)
}

export function BodyCanvas({ selected, resetSignal, peek, inset, onSelect }: Props) {
  return (
    <>
      <Canvas
        dpr={[1, 1.7]}
        camera={{ position: [HOME_POS.x, HOME_POS.y, HOME_POS.z], fov: 28, near: 0.02, far: 40 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0)
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.05
        }}
      >
        <Suspense fallback={null}>
          <Scene selected={selected} resetSignal={resetSignal} peek={peek} inset={inset} onSelect={onSelect} />
        </Suspense>
      </Canvas>
      <Loader />
    </>
  )
}

function Loader() {
  const { active, progress } = useProgress()
  if (!active && progress === 100) return null
  return (
    <div className="loader" role="status">
      <div className="loader-orbit" />
      <p>Собираем тело</p>
      <span>{Math.round(progress)}%</span>
    </div>
  )
}

function heroBox(root: THREE.Object3D, systemId: SystemId) {
  const items: { box: THREE.Box3; center: THREE.Vector3; tris: number }[] = []
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || mesh.userData.system !== systemId) return
    const box = new THREE.Box3().setFromObject(mesh)
    if (box.isEmpty()) return
    const geometry = mesh.geometry
    const tris = (geometry.index ? geometry.index.count : geometry.getAttribute('position').count) / 3
    items.push({ box, center: box.getCenter(new THREE.Vector3()), tris })
  })
  if (!items.length) return { box: new THREE.Box3(), focus: new THREE.Vector3() }

  // Самые детальные меши — это то, что человек видит как «сам орган»;
  // длинные гладкие сосуды и оболочки не должны уводить камеру.
  const seed = items.reduce((best, item) => (item.tris > best.tris ? item : best))
  const cluster = items.filter((item) => item.center.distanceTo(seed.center) <= 0.2)
  const focus = new THREE.Vector3()
  let mass = 0
  for (const item of cluster) {
    focus.addScaledVector(item.center, item.tris)
    mass += item.tris
  }
  const box = seed.box.clone()
  for (const item of items) {
    if (item.tris >= seed.tris * 0.06 && item.center.distanceTo(seed.center) <= 0.26) box.union(item.box)
  }
  return { box, focus: focus.divideScalar(mass) }
}

function goHome(rig: CameraControlsImpl, stageHeight: number, peek: number, animate: boolean) {
  const distance = homeDistance(stageHeight, peek)
  const direction = HOME_POS.clone().sub(HOME_TARGET).normalize()
  const position = HOME_TARGET.clone().addScaledVector(direction, distance)
  void rig.setLookAt(position.x, position.y, position.z, HOME_TARGET.x, HOME_TARGET.y, HOME_TARGET.z, animate)
}

function Scene({ selected, resetSignal, peek, inset, onSelect }: Props) {
  const gltf = useGLTF(MODEL_URL)
  const group = useRef<THREE.Group>(null)
  const controls = useRef<CameraControlsImpl>(null)
  const spin = useRef(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  const sway = useRef(0)
  const framed = useRef(false)
  const homed = useRef(false)
  const lastSelected = useRef<SystemId | null>(null)
  const camera = useThree((state) => state.camera as THREE.PerspectiveCamera)
  const size = useThree((state) => state.size)
  const insetTarget = useRef(0)
  const insetNow = useRef<number | null>(null)
  const insetApplied = useRef({ value: -1, width: 0, height: 0 })
  insetTarget.current = Math.min(inset, peek + size.height * 0.08)
  const selectedRef = useRef(selected)
  const hovered = useRef<SystemId | null>(null)
  const onSelectRef = useRef(onSelect)
  selectedRef.current = selected
  onSelectRef.current = onSelect

  const built = useMemo(() => buildParts(gltf.scene), [gltf.scene])
  const materials = useMemo(() => makeMaterials(), [])
  const skinMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: SKIN_TINT,
        roughness: 0.62,
        metalness: 0,
        transparent: true,
        opacity: 0.2,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [],
  )
  const shadow = useMemo(() => makeShadow(), [])
  const skinRisk = useMemo(() => {
    const system = SYSTEMS.find((item) => item.id === 'integumentary')!
    return new THREE.Color(MESH_COLOR[levelOf(system.risk)])
  }, [])

  useEffect(() => {
    const rig = controls.current
    if (!rig) return
    rig.smoothTime = 0.55
    rig.truckSpeed = 0
    rig.minDistance = 0.28
    rig.maxDistance = 6.5
    rig.minPolarAngle = 0.32
    rig.maxPolarAngle = Math.PI * 0.8
  }, [])

  useEffect(() => {
    const rig = controls.current
    const root = group.current
    if (!rig || !root) return
    if (!selected) {
      const wasFramed = framed.current
      framed.current = false
      lastSelected.current = null
      if (wasFramed) {
        spin.current = false
        root.rotation.y = DEFAULT_YAW
      }
      goHome(rig, size.height, peek, wasFramed || homed.current)
      homed.current = true
      return
    }
    if (framed.current && lastSelected.current === selected) return
    framed.current = true
    lastSelected.current = selected
    spin.current = false
    root.rotation.y = DEFAULT_YAW
    root.updateMatrixWorld(true)
    const { box, focus } = heroBox(root, selected)
    if (box.isEmpty()) return
    const center = focus
    const radius = box.getBoundingSphere(new THREE.Sphere()).radius
    const boxSize = box.getSize(new THREE.Vector3())
    const aspect = size.width / Math.max(size.height, 1)
    const fitWidth = (Math.max(boxSize.x, boxSize.z) * 0.5 * 1.15) / (TAN_HALF_FOV * aspect)
    const distance =
      selected === 'integumentary'
        ? homeDistance(size.height, peek)
        : THREE.MathUtils.clamp(Math.max(radius * 3.2, fitWidth), 0.32, 1.8)
    const offset = new THREE.Vector3(0.28, 0.16, 1).normalize().multiplyScalar(distance)
    const position = center.clone().add(offset)
    void rig.setLookAt(position.x, position.y, position.z, center.x, center.y, center.z, true)
  }, [selected, peek, size.height])

  useEffect(() => {
    if (resetSignal === 0) return
    const rig = controls.current
    const root = group.current
    if (!rig || !root) return
    spin.current = false
    root.rotation.y = DEFAULT_YAW
    goHome(rig, size.height, peek, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetSignal])

  useFrame(({ clock }, delta) => {
    if (spin.current && group.current && !selectedRef.current) {
      sway.current += delta
      group.current.rotation.y = DEFAULT_YAW + Math.sin(sway.current * 0.5) * 0.55
    }

    if (insetNow.current === null) insetNow.current = insetTarget.current
    const gap = insetTarget.current - insetNow.current
    insetNow.current = Math.abs(gap) < 0.3 ? insetTarget.current : insetNow.current + gap * (1 - Math.exp(-delta * 9))
    const value = Math.round(insetNow.current * 2) / 2
    const applied = insetApplied.current
    if (value !== applied.value || size.width !== applied.width || size.height !== applied.height) {
      applied.value = value
      applied.width = size.width
      applied.height = size.height
      if (value < 0.5) camera.clearViewOffset()
      else camera.setViewOffset(size.width, size.height, 0, value / 2, size.width, size.height)
    }
    const pulse = 0.08 * (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4))
    const current = selectedRef.current
    const hot = current ?? hovered.current
    for (const system of SYSTEMS) {
      const material = materials[system.id]
      const base = material.userData.base as THREE.Color
      const faded = Boolean(current) && system.id !== current
      material.transparent = true
      material.opacity = faded ? 0.16 : 1
      material.depthWrite = !faded
      if (hot && system.id !== hot) {
        material.color.copy(base).lerp(DIM, current ? 0.92 : 0.8)
        material.emissiveIntensity = 0.02
      } else if (hot && system.id === hot) {
        material.color.copy(base)
        material.emissiveIntensity = current === system.id ? 0.32 + pulse : 0.26
      } else {
        material.color.copy(base)
        material.emissiveIntensity = 0.16
      }
    }
    if (current === 'integumentary') {
      skinMaterial.color.copy(SKIN_TINT).lerp(skinRisk, 0.72)
      skinMaterial.opacity = 0.48
    } else if (current) {
      skinMaterial.color.copy(SKIN_TINT)
      skinMaterial.opacity = 0.05
    } else {
      skinMaterial.color.copy(SKIN_TINT)
      skinMaterial.opacity = hovered.current === 'integumentary' ? 0.3 : 0.2
    }
  })

  return (
    <>
      <Studio />
      <group ref={group} rotation={[0, DEFAULT_YAW, 0]}>
        {built.parts.map((part, index) => {
          const isSkin = part.id === 'integumentary'
          return (
            <mesh
              key={`${part.id}-${index}`}
              geometry={part.geometry}
              material={isSkin ? skinMaterial : materials[part.id]}
              renderOrder={isSkin ? 2 : 1}
              userData={{ system: part.id }}
            />
          )
        })}
      </group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, built.feet + 0.012, 0]} scale={[0.5, 0.26, 1]}>
        <circleGeometry args={[1, 48]} />
        <meshBasicMaterial map={shadow} transparent depthWrite={false} />
      </mesh>
      <Picker group={group} hovered={hovered} onSelectRef={onSelectRef} spin={spin} />
      <CameraControls ref={controls} dollyToCursor={false} />
    </>
  )
}

function Picker({
  group,
  hovered,
  onSelectRef,
  spin,
}: {
  group: RefObject<THREE.Group | null>
  hovered: RefObject<SystemId | null>
  onSelectRef: RefObject<(id: SystemId | null) => void>
  spin: RefObject<boolean>
}) {
  const { camera, gl } = useThree()
  const raycaster = useMemo(() => new THREE.Raycaster(), [])
  const pointer = useMemo(() => new THREE.Vector2(), [])

  useEffect(() => {
    const el = gl.domElement
    let downX = 0
    let downY = 0
    let moved = false
    let frame = 0

    const buckets = () => {
      const organs: THREE.Object3D[] = []
      const skins: THREE.Object3D[] = []
      group.current?.traverse((obj) => {
        const mesh = obj as THREE.Mesh
        if (!mesh.isMesh) return
        if (mesh.userData.system === 'integumentary') skins.push(mesh)
        else organs.push(mesh)
      })
      return { organs, skins }
    }

    const pick = (clientX: number, clientY: number): SystemId | null => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return null
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const { organs, skins } = buckets()
      const organHit = raycaster.intersectObjects(organs, false)[0]
      if (organHit) return organHit.object.userData.system as SystemId
      const skinHit = raycaster.intersectObjects(skins, false)[0]
      if (skinHit) return 'integumentary'
      return null
    }

    const onDown = (event: PointerEvent) => {
      downX = event.clientX
      downY = event.clientY
      moved = false
      spin.current = false
    }
    const onMove = (event: PointerEvent) => {
      if (Math.hypot(event.clientX - downX, event.clientY - downY) > 8) moved = true
      if (event.pointerType !== 'mouse') return
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        hovered.current = pick(event.clientX, event.clientY)
      })
    }
    const onUp = (event: PointerEvent) => {
      if (moved || Math.hypot(event.clientX - downX, event.clientY - downY) > 8) return
      onSelectRef.current(pick(event.clientX, event.clientY))
    }

    el.addEventListener('pointerdown', onDown)
    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerup', onUp)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener('pointerdown', onDown)
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerup', onUp)
    }
  }, [camera, gl, group, hovered, onSelectRef, pointer, raycaster, spin])

  return null
}

function Studio() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
    scene.environment = env
    scene.environmentIntensity = 0.5
    return () => {
      scene.environment = null
      env.dispose()
      pmrem.dispose()
    }
  }, [gl, scene])

  return (
    <>
      <hemisphereLight args={['#f8fbff', '#d5e4ec', 0.9]} />
      <ambientLight intensity={0.22} />
      <directionalLight position={[2.6, 5.4, 3.6]} intensity={2.15} color="#fff7f2" />
      <directionalLight position={[-3.4, 2.4, -1.2]} intensity={0.55} color="#d7ebff" />
      <directionalLight position={[0, 1.6, -3.4]} intensity={0.35} />
    </>
  )
}

function buildParts(root: THREE.Object3D): { parts: Part[]; feet: number } {
  const parts: Part[] = []
  const known = new Set(SYSTEMS.map((system) => system.id))
  root.updateMatrixWorld(true)
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh) return
    const id = mesh.name.split('__')[0] as SystemId
    if (!known.has(id)) return
    const geometry = mesh.geometry.clone()
    geometry.applyMatrix4(mesh.matrixWorld)
    geometry.computeVertexNormals()
    parts.push({ id, geometry })
  })

  const box = new THREE.Box3()
  for (const part of parts) {
    if (part.id !== 'integumentary') continue
    part.geometry.computeBoundingBox()
    if (part.geometry.boundingBox) box.union(part.geometry.boundingBox)
  }
  return { parts, feet: box.isEmpty() ? -0.9 : box.min.y }
}

function makeMaterials() {
  const map = {} as Record<SystemId, THREE.MeshPhysicalMaterial>
  for (const system of SYSTEMS) {
    const color = new THREE.Color(MESH_COLOR[levelOf(system.risk)])
    const material = new THREE.MeshPhysicalMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.16,
      roughness: 0.46,
      metalness: 0.02,
      clearcoat: 0.18,
      clearcoatRoughness: 0.55,
      side: THREE.DoubleSide,
    })
    material.userData.base = color
    map[system.id] = material
  }
  return map
}

function makeShadow() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const ctx = canvas.getContext('2d')
  if (!ctx) return new THREE.Texture()
  const gradient = ctx.createRadialGradient(64, 64, 10, 64, 64, 64)
  gradient.addColorStop(0, 'rgba(64, 84, 96, 0.32)')
  gradient.addColorStop(1, 'rgba(64, 84, 96, 0)')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, 128, 128)
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}
