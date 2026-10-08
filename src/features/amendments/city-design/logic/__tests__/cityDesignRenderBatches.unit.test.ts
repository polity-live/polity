import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createCityDesignRenderBatches } from '../cityDesignRenderBatches';

function harness(multiDraw = true) {
  const parent = new THREE.Group();
  parent.position.x = 52;
  const manager = createCityDesignRenderBatches(THREE, parent, multiDraw);
  const root = parent.getObjectByName('city-design-render-batches')!;
  const source = (id: string, mesh: THREE.Object3D) => {
    const group = new THREE.Group();
    group.add(mesh);
    parent.add(group);
    manager.add(id, group);
    return group;
  };
  const box = (color = '#ff0000') =>
    new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial({ color }));
  return { parent, manager, root, source, box };
}

describe('city design render batches', () => {
  it('shares primitive buffers across identities and preserves colors, split offsets, slots and untouched buffers', () => {
    const { manager, root, source, box } = harness();
    for (let i = 0; i < 40; i++) {
      const mesh = box(i % 2 ? '#00ff00' : '#ff0000');
      mesh.position.set(i / 10, 1, 0);
      source(String(i), mesh);
    }
    manager.flush();
    expect(root.children).toHaveLength(1);
    const mesh = root.children[0] as THREE.InstancedMesh;
    expect(mesh.count).toBe(40);
    expect(mesh.instanceMatrix.count).toBe(64);
    const matrix = new THREE.Matrix4(),
      color = new THREE.Color();
    mesh.getMatrixAt(1, matrix);
    expect(matrix.elements[12]).toBeCloseTo(0.1);
    mesh.getColorAt(1, color);
    expect(color.getHexString()).toBe('00ff00');
    const geometry = mesh.geometry;
    manager.remove('1');
    source('replacement', box());
    manager.flush();
    expect(root.children[0]).toBe(mesh);
    expect(mesh.geometry).toBe(geometry);
    expect(mesh.count).toBe(40);
    manager.remove('missing');
    manager.dispose();
    expect(root.children).toHaveLength(0);
  });

  it('handles instance colors and full bounds of long instances across cell boundaries', () => {
    const { manager, root, source } = harness();
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(100, 1, 1),
      new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      2
    );
    mesh.setMatrixAt(0, new THREE.Matrix4().makeTranslation(31, 0, 0));
    mesh.setMatrixAt(1, new THREE.Matrix4().makeTranslation(65, 0, 0));
    mesh.setColorAt(0, new THREE.Color('#ff0000'));
    mesh.setColorAt(1, new THREE.Color('#00ff00'));
    const group = source('long', mesh);
    manager.flush();
    expect(group.visible).toBe(false);
    expect(root.children).toHaveLength(2);
    const batch = root.children[0] as THREE.InstancedMesh;
    expect(batch.boundingBox!.min.x).toBeCloseTo(-19);
    expect(batch.boundingBox!.max.x).toBeCloseTo(81);
    manager.dispose();
  });

  it('batches clipped geometry, grows buffers, preserves holes and releases each buffer once', () => {
    const { manager, root, source } = harness();
    const shape = new THREE.Shape()
      .moveTo(-3, -3)
      .lineTo(3, -3)
      .lineTo(3, 3)
      .lineTo(-3, 3)
      .closePath();
    shape.holes.push(
      new THREE.Path().moveTo(-1, -1).lineTo(-1, 1).lineTo(1, 1).lineTo(1, -1).closePath()
    );
    for (let i = 0; i < 40; i++)
      source(
        String(i),
        new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({
            color: i % 2 ? '#00ff00' : '#ff0000',
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.75,
            forceSinglePass: true,
          })
        )
      );
    manager.flush();
    const batch = root.children[0] as THREE.BatchedMesh;
    expect(root.children).toHaveLength(1);
    expect(batch.instanceCount).toBe(40);
    expect(batch.sortObjects).toBe(true);
    expect(batch.perObjectFrustumCulled).toBe(true);
    expect(batch.geometry.getIndex()!.count).toBeGreaterThan(32);
    const disposed = vi.fn();
    batch.geometry.addEventListener('dispose', disposed);
    manager.remove('0');
    manager.flush();
    expect(batch.instanceCount).toBe(39);
    manager.dispose();
    expect(disposed).toHaveBeenCalledOnce();
  });

  it('merges only compatible opaque geometry without multi-draw and retains transparent sorting', () => {
    const { manager, root, source } = harness(false);
    const shape = new THREE.Shape().moveTo(0, 0).lineTo(3, 0).lineTo(0, 3).closePath();
    for (let i = 0; i < 3; i++)
      source(
        String(i),
        new THREE.Mesh(
          new THREE.ShapeGeometry(shape),
          new THREE.MeshBasicMaterial({ color: '#ff0000' })
        )
      );
    source(
      'transparent',
      new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.5 })
      )
    );
    manager.flush();
    expect(root.children).toHaveLength(2);
    const merged = root.children.find(
      child => !(child instanceof THREE.InstancedMesh)
    ) as THREE.Mesh;
    expect(merged.geometry.getAttribute('position').count).toBe(9);
    const previous = merged.geometry;
    manager.remove('1');
    source(
      'replacement',
      new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color: '#ff0000' })
      )
    );
    manager.flush();
    expect(merged.geometry).not.toBe(previous);
    expect(merged.geometry.getAttribute('position').count).toBe(9);
    manager.dispose();
  });

  it('converts line loops and strips into shared segments while excluding picking and hidden meshes', () => {
    const { manager, root, source, box } = harness();
    const group = new THREE.Group();
    const geometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 1, 0),
    ]);
    group.add(
      new THREE.LineLoop(geometry, new THREE.LineBasicMaterial()),
      new THREE.Line(geometry, new THREE.LineBasicMaterial()),
      new THREE.LineSegments(geometry.clone().setIndex([0, 1]), new THREE.LineBasicMaterial())
    );
    const pick = box();
    pick.userData.pickTarget = true;
    const hidden = box();
    hidden.visible = false;
    const hiddenGroup = new THREE.Group();
    hiddenGroup.visible = false;
    hiddenGroup.add(box());
    const singleton = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3()]),
      new THREE.LineBasicMaterial()
    );
    group.add(pick, hidden, hiddenGroup, singleton);
    source('lines', group);
    manager.flush();
    expect(root.children).toHaveLength(1);
    expect((root.children[0] as THREE.LineSegments).geometry.index!.count).toBe(12);
    manager.dispose();
  });

  it('reclaims deleted polygon ranges before growing non-indexed batch buffers', () => {
    const { manager, root, source } = harness();
    const shape = new THREE.Shape().moveTo(0, 0).lineTo(3, 0).lineTo(0, 3).closePath();
    const add = (id: string) =>
      source(
        id,
        new THREE.Mesh(new THREE.ShapeGeometry(shape).toNonIndexed(), new THREE.MeshBasicMaterial())
      );
    for (let i = 0; i < 40; i++) add(String(i));
    manager.flush();
    const mesh = root.children[0] as THREE.BatchedMesh;
    const grow = vi.spyOn(mesh, 'setGeometrySize');
    const optimize = vi.spyOn(mesh, 'optimize');
    for (let i = 0; i < 20; i++) manager.remove(String(i));
    for (let i = 40; i < 50; i++) add(String(i));
    manager.flush();
    expect(optimize).toHaveBeenCalled();
    expect(grow).not.toHaveBeenCalled();
    expect(mesh.instanceCount).toBe(30);
    manager.dispose();
  });

  it('switches prebuilt detail and vegetation batches without recreating GPU resources', () => {
    const { manager, root, source, box } = harness();
    const group = new THREE.Group();
    const canopy = new THREE.Mesh(
      new THREE.SphereGeometry(2, 18, 12),
      new THREE.MeshStandardMaterial()
    );
    canopy.userData.navigationCanopy = true;
    const conifer = new THREE.Mesh(new THREE.ConeGeometry(), new THREE.MeshStandardMaterial());
    conifer.userData.navigationCanopy = true;
    const detail = box();
    detail.userData.navigationDetail = true;
    group.add(canopy, conifer, detail, box());
    source('quality', group);
    manager.flush();
    const geometry = root.children.map(child => (child as THREE.Mesh).geometry);
    expect(root.children.filter(child => child.visible)).toHaveLength(4);
    manager.setMoving(true);
    expect(root.children.filter(child => child.visible)).toHaveLength(3);
    source('while-moving', box());
    manager.flush();
    manager.setMoving(false);
    expect(
      root.children.slice(0, geometry.length).map(child => (child as THREE.Mesh).geometry)
    ).toEqual(geometry);
    manager.dispose();
  });

  it('preserves array materials with independent ownership and can replace an existing entry', () => {
    const { manager, root, source } = harness();
    const materials = [
      new THREE.MeshBasicMaterial({ color: '#ff0000' }),
      new THREE.MeshBasicMaterial({ color: '#00ff00' }),
    ];
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    mesh.userData.navigationDetail = true;
    source('array', mesh);
    manager.flush();
    const rendered = root.children[0] as THREE.Mesh;
    expect(rendered.material).not.toBe(materials);
    manager.setMoving(true);
    expect(rendered.visible).toBe(false);
    manager.setMoving(false);
    const disposed = vi.fn();
    for (const material of rendered.material as THREE.Material[])
      material.addEventListener('dispose', disposed);
    manager.remove('array');
    expect(disposed).toHaveBeenCalledTimes(2);
    const ordinary = new THREE.Mesh(new THREE.BoxGeometry(), materials);
    source('ordinary-array', ordinary);
    manager.setMoving(true);
    expect(root.children[0].visible).toBe(true);
    manager.remove('ordinary-array');
    manager.setMoving(false);
    const noColor = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshNormalMaterial());
    source('normal', noColor);
    const instances = new THREE.InstancedMesh(
      new THREE.BoxGeometry(),
      new THREE.MeshNormalMaterial(),
      1
    );
    instances.setMatrixAt(0, new THREE.Matrix4().makeTranslation(2, 0, 0));
    source('uncolored-instances', instances);
    source('normal', noColor);
    manager.flush();
    expect(root.children).toHaveLength(1);
    manager.dispose();
  });
});
