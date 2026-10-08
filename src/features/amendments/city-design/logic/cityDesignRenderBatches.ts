import type * as Three from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

type ThreeModule = typeof Three;
type Quality = 'both' | 'full' | 'moving';
interface Slot {
  bucket: Bucket;
  index: number;
  geometryId?: number;
}
interface Bucket {
  key: string;
  quality: Quality;
  mesh: Three.InstancedMesh | Three.BatchedMesh | Three.Mesh | Three.LineSegments;
  kind: 'instances' | 'batch' | 'merged' | 'lines' | 'passthrough';
  count: number;
  free: number[];
  parts: Map<number, Three.BufferGeometry>;
  dirty: boolean;
  vertices: number;
  indices: number;
}

const primitives = new Set([
  'BoxGeometry',
  'PlaneGeometry',
  'SphereGeometry',
  'CylinderGeometry',
  'ConeGeometry',
  'CircleGeometry',
  'TorusGeometry',
]);
const capacity = (size: number) => 2 ** Math.ceil(Math.log2(Math.max(size, 32)));

/** Rendering owns copied buffers; source objects retain their independent picking identities. */
export function createCityDesignRenderBatches(
  THREE: ThreeModule,
  parent: Three.Group,
  multiDraw: boolean
) {
  const root = new THREE.Group();
  root.name = 'city-design-render-batches';
  parent.add(root);
  const buckets = new Map<string, Bucket>();
  const entries = new Map<string, Slot[]>();
  const materialKeys = new WeakMap<Three.Material, string>();
  const matrix = new THREE.Matrix4();
  const instanceMatrix = new THREE.Matrix4();
  const inverseParent = new THREE.Matrix4();
  const color = new THREE.Color();
  let moving = false;

  function materialKey(material: Three.Material) {
    let key = materialKeys.get(material);
    if (!key) {
      const json: Record<string, unknown> = { ...material.toJSON() };
      delete json.uuid;
      delete json.metadata;
      delete json.color;
      key = JSON.stringify(json);
      materialKeys.set(material, key);
    }
    return key;
  }

  function visible(bucket: Bucket) {
    bucket.mesh.visible =
      bucket.quality === 'both' ||
      (moving ? bucket.quality === 'moving' : bucket.quality === 'full');
  }

  function addPart(
    source: Three.Mesh | Three.Line,
    geometry: Three.BufferGeometry,
    transform: Three.Matrix4,
    tint: Three.Color,
    quality: Quality,
    slots: Slot[]
  ) {
    const material = source.material as Three.Material & { color?: Three.Color };
    const parameters = (geometry as Three.BufferGeometry & { parameters?: object }).parameters;
    const primitive = primitives.has(geometry.type) && parameters;
    geometry.computeBoundingBox();
    const center = (geometry.boundingBox as Three.Box3)
      .getCenter(new THREE.Vector3())
      .applyMatrix4(transform);
    const cell = `${Math.floor(center.x / 32)},${Math.floor(center.z / 32)}`;
    const format = Object.entries(geometry.attributes)
      .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`)
      .sort()
      .join(',');
    const kind =
      source instanceof THREE.Line
        ? 'lines'
        : primitive
          ? 'instances'
          : multiDraw
            ? 'batch'
            : material.transparent
              ? 'instances'
              : 'merged';
    // Transparent fallback instances share geometry only, preserving independent mesh depth sorting.
    const geometryKey = primitive
      ? `${geometry.type}:${JSON.stringify(parameters)}`
      : geometry.uuid;
    const key = `${cell}|${materialKey(material)}|${format}|${Boolean(geometry.index)}|${source.castShadow}|${source.receiveShadow}|${source.renderOrder}|${quality}|${kind}|${kind === 'instances' ? geometryKey : ''}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      const sharedMaterial = material.clone() as typeof material;
      sharedMaterial.color?.set('#ffffff');
      let mesh: Bucket['mesh'];
      if (kind === 'instances') {
        mesh = new THREE.InstancedMesh(geometry.clone(), sharedMaterial, 32);
        mesh.count = 0;
      } else if (kind === 'batch') {
        const batched = new THREE.BatchedMesh(
          32,
          capacity(geometry.getAttribute('position').count),
          capacity(geometry.index?.count ?? 0),
          sharedMaterial
        );
        batched.perObjectFrustumCulled = true;
        batched.sortObjects = material.transparent;
        mesh = batched;
      } else {
        sharedMaterial.vertexColors = true;
        mesh =
          kind === 'lines'
            ? new THREE.LineSegments(new THREE.BufferGeometry(), sharedMaterial)
            : new THREE.Mesh(new THREE.BufferGeometry(), sharedMaterial);
      }
      mesh.name = `render:${cell}:${kind}:${quality}`;
      mesh.userData.navigationDetail = quality === 'full';
      mesh.castShadow = source.castShadow;
      mesh.receiveShadow = source.receiveShadow;
      mesh.renderOrder = source.renderOrder;
      mesh.matrixAutoUpdate = false;
      root.add(mesh);
      bucket = {
        key,
        quality,
        mesh,
        kind,
        count: 0,
        free: [],
        parts: new Map(),
        dirty: true,
        vertices:
          mesh instanceof THREE.BatchedMesh ? capacity(geometry.getAttribute('position').count) : 0,
        indices: mesh instanceof THREE.BatchedMesh ? capacity(geometry.index?.count ?? 0) : 0,
      };
      visible(bucket);
      buckets.set(key, bucket);
    }
    let index: number;
    let geometryId: number | undefined;
    if (bucket.kind === 'instances') {
      let mesh = bucket.mesh as Three.InstancedMesh;
      index = bucket.free.pop() ?? mesh.count++;
      if (index >= mesh.instanceMatrix.count) {
        const replacement = new THREE.InstancedMesh(
          mesh.geometry,
          mesh.material,
          capacity(index + 1)
        );
        replacement.copy(mesh);
        // Object3D.copy preserves transforms; InstancedMesh.copy replaces the newly allocated buffers.
        replacement.instanceMatrix = new THREE.InstancedBufferAttribute(
          new Float32Array(capacity(index + 1) * 16),
          16
        );
        replacement.instanceMatrix.array.set(mesh.instanceMatrix.array);
        replacement.instanceColor = new THREE.InstancedBufferAttribute(
          new Float32Array(capacity(index + 1) * 3),
          3
        );
        replacement.instanceColor.array.set(
          (mesh.instanceColor as Three.InstancedBufferAttribute).array
        );
        root.remove(mesh);
        mesh.dispose();
        root.add(replacement);
        bucket.mesh = mesh = replacement;
      }
      mesh.setMatrixAt(index, transform);
      mesh.setColorAt(index, tint);
      mesh.instanceMatrix.needsUpdate = true;
      (mesh.instanceColor as Three.InstancedBufferAttribute).needsUpdate = true;
    } else if (bucket.kind === 'batch') {
      const mesh = bucket.mesh as Three.BatchedMesh;
      const vertices = geometry.getAttribute('position').count;
      const indices = geometry.index?.count ?? 0;
      if (mesh.unusedVertexCount < vertices || mesh.unusedIndexCount < indices) {
        mesh.optimize();
        if (mesh.unusedVertexCount < vertices || mesh.unusedIndexCount < indices) {
          bucket.vertices = capacity(bucket.vertices + vertices);
          bucket.indices = capacity(bucket.indices + indices);
          mesh.setGeometrySize(bucket.vertices, bucket.indices);
        }
      }
      if (mesh.instanceCount >= mesh.maxInstanceCount)
        mesh.setInstanceCount(capacity(mesh.maxInstanceCount + 1));
      geometryId = mesh.addGeometry(geometry);
      index = mesh.addInstance(geometryId);
      mesh.setMatrixAt(index, transform);
      mesh.setColorAt(index, tint);
    } else {
      index = bucket.free.pop() ?? bucket.parts.size;
      const part = geometry.clone().applyMatrix4(transform);
      const colors = new Float32Array(part.getAttribute('position').count * 3);
      for (let i = 0; i < colors.length; i += 3) tint.toArray(colors, i);
      part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      bucket.parts.set(index, part);
    }
    bucket.count++;
    bucket.dirty = true;
    slots.push({ bucket, index, geometryId });
  }

  function remove(id: string) {
    for (const { bucket, index, geometryId } of entries.get(id) ?? []) {
      if (bucket.kind === 'batch') {
        const mesh = bucket.mesh as Three.BatchedMesh;
        mesh.deleteInstance(index);
        mesh.deleteGeometry(geometryId as number);
      } else if (bucket.kind === 'instances') {
        const mesh = bucket.mesh as Three.InstancedMesh;
        mesh.setMatrixAt(index, matrix.makeScale(0, 0, 0));
        mesh.instanceMatrix.needsUpdate = true;
        bucket.free.push(index);
      } else if (bucket.kind !== 'passthrough') {
        (bucket.parts.get(index) as Three.BufferGeometry).dispose();
        bucket.parts.delete(index);
        bucket.free.push(index);
      }
      bucket.count--;
      bucket.dirty = true;
      if (!bucket.count) {
        root.remove(bucket.mesh);
        const materials = Array.isArray(bucket.mesh.material)
          ? bucket.mesh.material
          : [bucket.mesh.material];
        for (const material of materials) material.dispose();
        if (bucket.mesh instanceof THREE.BatchedMesh) bucket.mesh.dispose();
        else {
          bucket.mesh.geometry.dispose();
          if (bucket.mesh instanceof THREE.InstancedMesh) bucket.mesh.dispose();
        }
        buckets.delete(bucket.key);
      }
    }
    entries.delete(id);
  }

  return {
    add(id: string, group: Three.Group) {
      remove(id);
      group.updateWorldMatrix(true, true);
      inverseParent.copy(parent.matrixWorld).invert();
      const slots: Slot[] = [];
      group.traverse(object => {
        if (
          !(object instanceof THREE.Mesh || object instanceof THREE.Line) ||
          !object.visible ||
          object.userData.pickTarget
        )
          return;
        let ancestor: Three.Object3D | null = object;
        let detail = false;
        while (ancestor && ancestor !== group) {
          if (!ancestor.visible) return;
          detail ||= Boolean(ancestor.userData.navigationDetail);
          ancestor = ancestor.parent;
        }
        const transform = new THREE.Matrix4().multiplyMatrices(inverseParent, object.matrixWorld);
        if (Array.isArray(object.material)) {
          const mesh = object.clone(false) as Three.Mesh;
          mesh.geometry = object.geometry.clone();
          mesh.material = object.material.map(material => material.clone());
          mesh.matrix.copy(transform);
          mesh.matrixAutoUpdate = false;
          root.add(mesh);
          const key = object.uuid;
          const bucket: Bucket = {
            key,
            quality: detail ? 'full' : 'both',
            mesh,
            kind: 'passthrough',
            count: 1,
            free: [],
            parts: new Map(),
            dirty: false,
            vertices: 0,
            indices: 0,
          };
          visible(bucket);
          buckets.set(key, bucket);
          slots.push({ bucket, index: 0 });
          return;
        }
        const material = object.material as Three.Material & { color?: Three.Color };
        const count = object instanceof THREE.InstancedMesh ? object.count : 1;
        let geometry = object.geometry;
        let lineGeometry: Three.BufferGeometry | undefined;
        if (object instanceof THREE.Line && !(object instanceof THREE.LineSegments)) {
          const points = geometry.getAttribute('position');
          const indices: number[] = [];
          for (let i = 1; i < points.count; i++) indices.push(i - 1, i);
          if (object instanceof THREE.LineLoop && points.count > 1)
            indices.push(points.count - 1, 0);
          const segments = geometry.clone();
          segments.setIndex(indices);
          lineGeometry = geometry = segments;
        }
        for (let i = 0; i < count; i++) {
          matrix.copy(transform);
          color.copy(material.color ?? new THREE.Color('#ffffff'));
          if (object instanceof THREE.InstancedMesh) {
            object.getMatrixAt(i, instanceMatrix);
            matrix.multiply(instanceMatrix);
            if (object.instanceColor) {
              const instanceColor = new THREE.Color();
              object.getColorAt(i, instanceColor);
              color.multiply(instanceColor);
            }
          }
          const vegetation = object.userData.navigationCanopy;
          addPart(object, geometry, matrix, color, detail || vegetation ? 'full' : 'both', slots);
          if (vegetation && geometry.type === 'SphereGeometry') {
            const radius = (geometry as Three.SphereGeometry).parameters.radius;
            const low = new THREE.SphereGeometry(radius, 8, 6);
            addPart(object, low, matrix, color, 'moving', slots);
            low.dispose();
          } else if (vegetation) {
            addPart(object, geometry, matrix, color, 'moving', slots);
          }
        }
        lineGeometry?.dispose();
      });
      group.visible = false;
      entries.set(id, slots);
    },
    remove,
    flush() {
      for (const bucket of buckets.values()) {
        if (!bucket.dirty) continue;
        if (bucket.kind === 'merged' || bucket.kind === 'lines') {
          bucket.mesh.geometry.dispose();
          bucket.mesh.geometry = mergeGeometries([
            ...bucket.parts.values(),
          ]) as Three.BufferGeometry;
        }
        if (
          bucket.mesh instanceof THREE.InstancedMesh ||
          bucket.mesh instanceof THREE.BatchedMesh
        ) {
          bucket.mesh.computeBoundingBox();
          bucket.mesh.computeBoundingSphere();
        } else {
          bucket.mesh.geometry.computeBoundingSphere();
        }
        bucket.dirty = false;
      }
    },
    setMoving(value: boolean) {
      moving = value;
      for (const bucket of buckets.values()) visible(bucket);
    },
    dispose() {
      for (const id of entries.keys()) remove(id);
      root.removeFromParent();
    },
  };
}
