import type {
  CorridorGeometry,
  StreetDesignLocalPoint,
  StreetDesignObject,
  StreetDesignStateV1,
} from '../types';
import { getStreetDesignComparisonLayers } from './streetDesignDiff';
import { getStreetDesignObjectDefinition } from './streetDesignObjectRegistry';
import { createCorridorGeometry } from './streetDesignPlacement';
import { projectGeoPointToLocal } from './streetDesignProjection';

export interface StreetDesignSceneMountOptions {
  canvas: HTMLCanvasElement;
  design: StreetDesignStateV1;
  placementPreview: CorridorGeometry | null;
  selectedObjectId: string | null;
  readOnly: boolean;
  onPointerDown: (point: StreetDesignLocalPoint) => void;
  onPointerMove: (point: StreetDesignLocalPoint) => void;
  onObjectSelect: (objectId: string | null) => void;
}

type ThreeModule = typeof import('three');
type Object3D = import('three').Object3D;
type Group = import('three').Group;
function makeShape(THREE: ThreeModule, points: StreetDesignLocalPoint[]) {
  const shape = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) {
      shape.moveTo(point.x, point.z);
    } else {
      shape.lineTo(point.x, point.z);
    }
  });
  shape.closePath();
  return shape;
}

function setObjectId(object: Object3D, objectId: string) {
  object.userData.objectId = objectId;
  object.children.forEach(child => setObjectId(child, objectId));
}

function addFlatPolygon(args: {
  THREE: ThreeModule;
  group: Group;
  points: StreetDesignLocalPoint[];
  color: string;
  opacity?: number;
  y?: number;
  objectId?: string;
}) {
  const { THREE, group, points, color, opacity = 1, y = 0.02, objectId } = args;
  if (points.length < 3) return null;

  const geometry = new THREE.ShapeGeometry(makeShape(THREE, points));
  const material = new THREE.MeshStandardMaterial({
    color,
    transparent: opacity < 1,
    opacity,
    roughness: 0.85,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = y;

  if (objectId) {
    setObjectId(mesh, objectId);
  }

  group.add(mesh);
  return mesh;
}

function addCorridorMesh(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: CorridorGeometry;
  color: string;
  opacity?: number;
  y?: number;
  objectId?: string;
}) {
  return addFlatPolygon({
    THREE: args.THREE,
    group: args.group,
    points: args.geometry.polygon,
    color: args.color,
    opacity: args.opacity,
    y: args.y,
    objectId: args.objectId,
  });
}

function addCorridorOutline(args: {
  THREE: ThreeModule;
  group: Group;
  geometry: CorridorGeometry;
  color: string;
  y?: number;
  objectId?: string;
}) {
  const { THREE, group, geometry, color, y = 0.16, objectId } = args;
  const vertices = geometry.polygon.map(point => new THREE.Vector3(point.x, y, point.z));
  const lineGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
  const line = new THREE.LineLoop(
    lineGeometry,
    new THREE.LineBasicMaterial({ color, linewidth: 2 })
  );

  if (objectId) {
    setObjectId(line, objectId);
  }

  group.add(line);
}

function addPointObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
}) {
  const { THREE, group, object, selected } = args;
  if (object.geometry.kind !== 'point') return;

  const definition = getStreetDesignObjectDefinition(object.type);
  const root = new THREE.Group();
  root.position.set(object.geometry.point.x, 0, object.geometry.point.z);
  root.rotation.y = object.geometry.rotation;

  if (definition.renderKind === 'tree') {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.11, 0.16, 1.5, 8),
      new THREE.MeshStandardMaterial({ color: '#6f4d31' })
    );
    trunk.position.y = 0.75;
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(0.9, 18, 12),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.8 })
    );
    canopy.position.y = 1.8;
    root.add(trunk, canopy);
  } else if (definition.renderKind === 'bush') {
    const bush = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 16, 10),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.9 })
    );
    bush.scale.y = 0.65;
    bush.position.y = 0.42;
    root.add(bush);
  } else {
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.18, 0.42),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.55 })
    );
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(1.4, 0.5, 0.14),
      new THREE.MeshStandardMaterial({ color: definition.color, roughness: 0.55 })
    );
    seat.position.y = 0.55;
    back.position.set(0, 0.78, -0.22);
    root.add(seat, back);
  }

  if (selected) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.12, 0.025, 8, 36),
      new THREE.MeshBasicMaterial({ color: '#facc15' })
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    root.add(ring);
  }

  setObjectId(root, object.id);
  group.add(root);
}

function addDesignObject(args: {
  THREE: ThreeModule;
  group: Group;
  object: StreetDesignObject;
  selected: boolean;
  opacity?: number;
  y?: number;
}) {
  const { THREE, group, object, selected, opacity = 1, y = 0.05 } = args;
  const definition = getStreetDesignObjectDefinition(object.type);

  if (object.geometry.kind === 'point') {
    addPointObject({ THREE, group, object, selected });
    return;
  }

  if (object.geometry.kind === 'corridor') {
    addCorridorMesh({
      THREE,
      group,
      geometry: object.geometry,
      color: definition.color,
      opacity,
      y,
      objectId: object.id,
    });

    if (selected) {
      addCorridorOutline({
        THREE,
        group,
        geometry: object.geometry,
        color: '#facc15',
        objectId: object.id,
      });
    }
  }
}

function addOsmWays(THREE: ThreeModule, group: Group, design: StreetDesignStateV1) {
  const snapshot = design.osmSnapshot;
  if (!snapshot) return;

  snapshot.ways.forEach(way => {
    const localPoints = way.points.map(point => projectGeoPointToLocal(point, design.origin));

    if (way.kind === 'road') {
      for (let index = 0; index < localPoints.length - 1; index += 1) {
        addCorridorMesh({
          THREE,
          group,
          geometry: createCorridorGeometry(localPoints[index], localPoints[index + 1], 4.8),
          color: '#7a8288',
          opacity: 0.8,
          y: 0.01,
        });
      }
      return;
    }

    if (way.kind === 'building') {
      const xs = localPoints.map(point => point.x);
      const zs = localPoints.map(point => point.z);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minZ = Math.min(...zs);
      const maxZ = Math.max(...zs);
      const height = Math.max(way.height ?? 8, 3);
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(Math.max(maxX - minX, 2), height, Math.max(maxZ - minZ, 2)),
        new THREE.MeshStandardMaterial({ color: '#b6aa9b', roughness: 0.75 })
      );
      mesh.position.set((minX + maxX) / 2, height / 2, (minZ + maxZ) / 2);
      group.add(mesh);
      return;
    }

    addFlatPolygon({
      THREE,
      group,
      points: localPoints,
      color: way.kind === 'water' ? '#72a6d8' : '#9dbb78',
      opacity: 0.75,
      y: 0.015,
    });
  });
}

function createSceneGroups(THREE: ThreeModule, scene: import('three').Scene) {
  const originalGroup = new THREE.Group();
  const designGroup = new THREE.Group();
  scene.add(originalGroup, designGroup);
  return { originalGroup, designGroup };
}

export async function mountStreetDesignScene(options: StreetDesignSceneMountOptions) {
  const THREE = await import('three');
  const canvas = options.canvas;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
  renderer.setClearColor(0xf7f5ef, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf7f5ef, 90, 220);

  const camera = new THREE.PerspectiveCamera(
    45,
    Math.max(canvas.clientWidth / Math.max(canvas.clientHeight, 1), 1),
    0.1,
    500
  );
  camera.position.set(0, 75, 85);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const sun = new THREE.DirectionalLight(0xffffff, 1.2);
  sun.position.set(35, 80, 25);
  scene.add(sun);

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(220, 220),
    new THREE.MeshStandardMaterial({ color: '#ede8dc', roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);

  const grid = new THREE.GridHelper(220, 44, 0xd0c7b9, 0xe0d8cb);
  grid.position.y = 0;
  scene.add(grid);

  const layers = getStreetDesignComparisonLayers(options.design.comparisonMode);
  const { originalGroup, designGroup } = createSceneGroups(THREE, scene);

  if (layers.split) {
    originalGroup.position.x = -52;
    designGroup.position.x = 52;
  }

  if (layers.showOriginal) {
    addOsmWays(THREE, originalGroup, options.design);
  }

  if (layers.showDesign) {
    const designOpacity = layers.showOverlay ? 0.72 : 1;
    options.design.objects.forEach(object => {
      addDesignObject({
        THREE,
        group: designGroup,
        object,
        selected: object.id === options.selectedObjectId,
        opacity: designOpacity,
        y: layers.showOverlay ? 0.08 : 0.05,
      });
    });
  }

  if (options.placementPreview) {
    addCorridorMesh({
      THREE,
      group: designGroup,
      geometry: options.placementPreview,
      color: '#facc15',
      opacity: 0.45,
      y: 0.12,
    });
  }

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const pointerPoint = new THREE.Vector3();

  function resize() {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.floor(width * renderer.getPixelRatio())) {
      renderer.setSize(width, height, false);
      camera.aspect = Math.max(width / Math.max(height, 1), 1);
      camera.updateProjectionMatrix();
    }
  }

  function updatePointer(event: PointerEvent) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    raycaster.ray.intersectPlane(groundPlane, pointerPoint);
    return {
      x: pointerPoint.x,
      z: pointerPoint.z,
    };
  }

  function handlePointerDown(event: PointerEvent) {
    const point = updatePointer(event);
    const intersections = raycaster.intersectObjects(designGroup.children, true);
    const hitObjectId = intersections.find(hit => hit.object.userData.objectId)?.object.userData
      .objectId as string | undefined;

    if (hitObjectId) {
      options.onObjectSelect(hitObjectId);
      return;
    }

    if (layers.split && point.x < 0) {
      options.onObjectSelect(null);
      return;
    }

    if (!options.readOnly) {
      options.onPointerDown({
        x: point.x - designGroup.position.x,
        z: point.z - designGroup.position.z,
      });
    } else {
      options.onObjectSelect(null);
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (!options.readOnly) {
      const point = updatePointer(event);
      options.onPointerMove({
        x: point.x - designGroup.position.x,
        z: point.z - designGroup.position.z,
      });
    }
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);

  let animationFrame = 0;
  function render() {
    resize();
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(render);
  }
  render();

  return () => {
    window.cancelAnimationFrame(animationFrame);
    canvas.removeEventListener('pointerdown', handlePointerDown);
    canvas.removeEventListener('pointermove', handlePointerMove);
    renderer.dispose();
  };
}
