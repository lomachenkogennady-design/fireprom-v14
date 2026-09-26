"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { profilePoints, type BendSpec, type Pt } from "@/lib/geometry";
import { MATERIALS, type MaterialKey } from "@/lib/materials";

interface Props {
  flanges: number[];
  bends: BendSpec[];
  /** ширина по оси гибки, мм */
  width: number;
  thickness: number;
  /** внутренний радиус гиба, мм */
  radius: number;
  material: MaterialKey;
}

const rad = (d: number) => (d * Math.PI) / 180;
const sub = (a: Pt, b: Pt): Pt => ({ x: a.x - b.x, y: a.y - b.y });
const unit = (v: Pt): Pt => {
  const l = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / l, y: v.y / l };
};
const perp = (d: Pt): Pt => ({ x: -d.y, y: d.x });

/** Скругление углов осевой линии параболами (как в 2D-превью) */
function roundedCenterline(pts: Pt[], bends: BendSpec[], rCorner: number): Pt[] {
  const out: Pt[] = [pts[0]];
  let bendIdx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const p0 = pts[i - 1];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const a = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const b = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const turn = Math.min(Math.max(bends[bendIdx]?.angle ?? 90, 5), 175);
    bendIdx++;
    const t = Math.min(rCorner * Math.tan(rad(turn) / 2), Math.min(a, b) * 0.45);
    const inPt = {
      x: p1.x - ((p1.x - p0.x) / a) * t,
      y: p1.y - ((p1.y - p0.y) / a) * t,
    };
    const outPt = {
      x: p1.x + ((p2.x - p1.x) / b) * t,
      y: p1.y + ((p2.y - p1.y) / b) * t,
    };
    out.push(inPt);
    const S = 10;
    for (let s = 1; s < S; s++) {
      const u = s / S;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * (1 - u) * u;
      const w2 = u * u;
      out.push({
        x: w0 * inPt.x + w1 * p1.x + w2 * outPt.x,
        y: w0 * inPt.y + w1 * p1.y + w2 * outPt.y,
      });
    }
    out.push(outPt);
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** Двустороннее смещение ломаной → замкнутый контур толщиной 2·half */
function offsetOutline(pts: Pt[], half: number): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    let normal: Pt;
    let scale = half;
    if (i === 0) {
      normal = perp(unit(sub(pts[1], pts[0])));
    } else if (i === n - 1) {
      normal = perp(unit(sub(pts[n - 1], pts[n - 2])));
    } else {
      const d1 = unit(sub(pts[i], pts[i - 1]));
      const d2 = unit(sub(pts[i + 1], pts[i]));
      const n1 = perp(d1);
      const n2 = perp(d2);
      const m = unit({ x: n1.x + n2.x, y: n1.y + n2.y });
      const denom = Math.max(m.x * n1.x + m.y * n1.y, 0.3);
      normal = m;
      scale = half / denom;
    }
    left.push({ x: p.x + normal.x * scale, y: p.y + normal.y * scale });
    right.push({ x: p.x - normal.x * scale, y: p.y - normal.y * scale });
  }
  return [...left, ...right.reverse()];
}

export default function Part3D(props: Props) {
  const mountRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    mesh: THREE.Mesh | null;
    raf: number;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  const outline = useMemo(() => {
    const cl = profilePoints(props.flanges, props.bends);
    const rounded = roundedCenterline(cl, props.bends, Math.max(props.radius + props.thickness / 2, 0.5));
    return offsetOutline(rounded, props.thickness / 2);
  }, [props.flanges, props.bends, props.radius, props.thickness]);

  const outlineKey = useMemo(
    () => JSON.stringify([outline.length, outline[0], outline[outline.length - 1], props.width]),
    [outline, props.width]
  );

  // инициализация сцены — один раз
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      42,
      mount.clientWidth / Math.max(mount.clientHeight, 1),
      0.1,
      20000
    );
    camera.position.set(180, 140, 220);

    const hemi = new THREE.HemisphereLight(0xffffff, 0x1a1d22, 1.15);
    scene.add(hemi);
    const key = new THREE.DirectionalLight(0xffffff, 1.7);
    key.position.set(3, 5, 2.5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xff8a4d, 0.55);
    rim.position.set(-4, -1, -3);
    scene.add(rim);

    const grid = new THREE.GridHelper(600, 20, 0x2c313a, 0x191c21);
    scene.add(grid);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;

    const world = { scene, camera, renderer, controls, mesh: null as THREE.Mesh | null, raf: 0 };
    worldRef.current = world;

    const loop = () => {
      world.raf = requestAnimationFrame(loop);
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = Math.max(mount.clientHeight, 1);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    });
    ro.observe(mount);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(world.raf);
      controls.dispose();
      if (world.mesh) {
        world.mesh.geometry.dispose();
        (world.mesh.material as THREE.Material).dispose();
      }
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      worldRef.current = null;
    };
  }, []);

  // пересборка геометрии при изменении параметров
  useEffect(() => {
    const world = worldRef.current;
    if (!world) return;

    const shape = new THREE.Shape();
    outline.forEach((p, i) => {
      if (i === 0) shape.moveTo(p.x, p.y);
      else shape.lineTo(p.x, p.y);
    });
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: Math.max(props.width, 1),
      bevelEnabled: false,
      curveSegments: 4,
    });
    geo.translate(0, 0, -props.width / 2);
    geo.center();
    geo.computeBoundingBox();

    const mat = MATERIALS[props.material];
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color(mat.color3d),
      metalness: 0.85,
      roughness: 0.32,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, material);
    // осевую (xy) кладём правильно: деталь стоит на плоскости
    world.scene.add(mesh);

    if (world.mesh) {
      world.scene.remove(world.mesh);
      world.mesh.geometry.dispose();
      (world.mesh.material as THREE.Material).dispose();
    }
    world.mesh = mesh;

    // подгон камеры
    const bb = geo.boundingBox ?? new THREE.Box3();
    const size = bb.getSize(new THREE.Vector3());
    const center = bb.getCenter(new THREE.Vector3());
    const gridObj = world.scene.children.find((c) => c instanceof THREE.GridHelper) as
      | THREE.GridHelper
      | undefined;
    if (gridObj) {
      gridObj.position.y = bb.min.y - 1;
      const s = Math.max(size.x, size.y, size.z) * 3;
      gridObj.scale.setScalar(Math.max(s / 600, 0.2));
    }
    const maxDim = Math.max(size.x, size.y, size.z, 10);
    const dist = maxDim * 1.6;
    world.camera.near = dist / 200;
    world.camera.far = dist * 20;
    world.camera.position.set(center.x + dist * 0.85, center.y + dist * 0.6, center.z + dist * 0.95);
    world.camera.updateProjectionMatrix();
    world.controls.target.copy(center);
    world.controls.update();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outlineKey, props.width, props.material, props.thickness, outline]);

  if (failed) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="max-w-xs text-xs leading-relaxed text-steel">
          WebGL недоступен на этом устройстве — используйте вкладки
          «Вид сбоку» и «Развёртка»: они рисуются на SVG и работают везде.
        </p>
      </div>
    );
  }

  return <div ref={mountRef} className="h-full w-full" />;
}
