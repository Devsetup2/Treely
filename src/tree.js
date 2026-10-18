import * as THREE from 'three';

/* ------------------------------------------------------------------ */
/*  Mevsim ayarları                                                    */
/* ------------------------------------------------------------------ */
export const SEASONS = {
  spring: {
    leaves: [
      ['#b4dd86', 3],
      ['#a2d06c', 2],
      ['#c8e8a0', 2],
      ['#ffc2d4', 4],
      ['#ffb0c6', 3],
      ['#ffd8e4', 3],
      ['#f6a3bd', 1],
    ],
    density: 0.97,
    size: 0.9,
    grass: ['#93d85f', '#a8e374', '#7fcb4c', '#b5e98a'],
    grassScale: 0.9,
    falling: ['#ffc2d4', '#ffd8e4', '#ffb0c6'],
    fallCount: 26,
    trunk: '#a47650',
  },
  summer: {
    leaves: [
      ['#7ccf55', 4],
      ['#93dc63', 3],
      ['#66bb4a', 2],
      ['#aee576', 3],
      ['#86d45a', 3],
    ],
    density: 1,
    size: 1,
    grass: ['#5fbf3a', '#78d048', '#4fae32', '#9be05f'],
    grassScale: 1,
    falling: ['#86d257', '#a1dc68'],
    fallCount: 10,
    trunk: '#9a6a44',
  },
  autumn: {
    leaves: [
      ['#e8782e', 4],
      ['#d9532b', 3],
      ['#f2b335', 3],
      ['#c23d2a', 2],
      ['#eacb5b', 2],
      ['#b9602b', 1],
    ],
    density: 0.78,
    size: 1.02,
    grass: ['#b9c53a', '#d4b832', '#a3b52f', '#e0a830'],
    grassScale: 0.8,
    falling: ['#e8782e', '#f2b335', '#c23d2a', '#eacb5b'],
    fallCount: 40,
    trunk: '#8c5c38',
  },
};

/* ------------------------------------------------------------------ */
/*  Yardımcılar                                                        */
/* ------------------------------------------------------------------ */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const smooth = (x) => {
  x = Math.min(1, Math.max(0, x));
  return x * x * (3 - 2 * x);
};
function weightedPick(list, r) {
  const total = list.reduce((s, [, w]) => s + w, 0);
  let x = r * total;
  for (const [c, w] of list) {
    x -= w;
    if (x <= 0) return c;
  }
  return list[list.length - 1][0];
}

const PLATFORM = 6.4; // zemin kenar uzunluğu
const HALF = PLATFORM / 2;

/* ------------------------------------------------------------------ */
/*  Ana fabrika                                                        */
/* ------------------------------------------------------------------ */
export function createTree(container, { onTap } = {}) {
  const rand = mulberry32(20261016);
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /* --- renderer / sahne / kamera --- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'manipulation';

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 100);
  const ELEV = THREE.MathUtils.degToRad(27);
  const AZIM = THREE.MathUtils.degToRad(45);
  const target = new THREE.Vector3(0, 3.1, 0);
  const camDist = 40;
  camera.position.set(
    target.x + Math.cos(ELEV) * Math.sin(AZIM) * camDist,
    target.y + Math.sin(ELEV) * camDist,
    target.z + Math.cos(ELEV) * Math.cos(AZIM) * camDist
  );
  camera.lookAt(target);
  camera.updateMatrixWorld();

  /* --- ışıklar --- */
  scene.add(new THREE.HemisphereLight('#fffaf0', '#efe3cf', 1.9));
  const sun = new THREE.DirectionalLight('#fff1d8', 1.5);
  sun.position.set(-7, 13, 6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -7;
  sun.shadow.camera.right = 7;
  sun.shadow.camera.top = 7;
  sun.shadow.camera.bottom = -7;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.radius = 5;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.03;
  scene.add(sun);

  const world = new THREE.Group(); // yaw (fare paralaksı) için
  scene.add(world);
  const uniforms = { uTime: { value: 0 } };

  /* ---------------------------------------------------------------- */
  /*  Zemin                                                            */
  /* ---------------------------------------------------------------- */
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(PLATFORM + 0.02, 0.55, PLATFORM + 0.02),
    new THREE.MeshLambertMaterial({ color: '#d6cfc2' })
  );
  base.position.y = -0.28;
  base.receiveShadow = true;
  world.add(base);

  const TILES = 16;
  const tileSize = PLATFORM / TILES;
  const tileGeo = new THREE.BoxGeometry(tileSize * 0.97, 0.1, tileSize * 0.97);
  const tileMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  const tiles = new THREE.InstancedMesh(tileGeo, tileMat, TILES * TILES);
  tiles.receiveShadow = true;
  const tilePalette = ['#f1ebdf', '#e6decf', '#f7f3ea', '#ddd5c5', '#eee6d8'];
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  for (let i = 0; i < TILES; i++) {
    for (let j = 0; j < TILES; j++) {
      const idx = i * TILES + j;
      m4.makeTranslation(-HALF + tileSize * (i + 0.5), 0.0, -HALF + tileSize * (j + 0.5));
      tiles.setMatrixAt(idx, m4);
      const checker = (i + j) % 2 === 0 ? 0 : 2;
      col.set(tilePalette[(checker + Math.floor(rand() * 3)) % tilePalette.length]);
      tiles.setColorAt(idx, col);
    }
  }
  world.add(tiles);

  /* ---------------------------------------------------------------- */
  /*  Çimen                                                            */
  /* ---------------------------------------------------------------- */
  const BLADES = 1100;
  const bladeGeo = new THREE.ConeGeometry(0.045, 0.5, 3, 1);
  bladeGeo.translate(0, 0.25, 0);
  const grassMat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
  grassMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
         vec3 ip = vec3(instanceMatrix[3][0], 0.0, instanceMatrix[3][2]);
         float sway = sin(uTime * 1.9 + ip.x * 2.3 + ip.z * 1.7);
         transformed.x += sway * 0.07 * position.y;
         transformed.z += cos(uTime * 1.6 + ip.z * 2.1) * 0.05 * position.y;`
      );
  };
  const grass = new THREE.InstancedMesh(bladeGeo, grassMat, BLADES);
  grass.castShadow = false;
  grass.receiveShadow = true;
  const grassData = []; // { r1, scale }
  {
    const dummy = new THREE.Object3D();
    // Kenar şeridi boyunca kümeler (özellikle köşelerde)
    const clumps = [];
    const bandMax = 0.95;
    const perimeterPoint = (t, inset) => {
      // t: 0..4 çevre parametresi; inset: kenardan içeri uzaklık
      const side = Math.floor(t) % 4;
      const f = t - Math.floor(t);
      const a = -HALF + inset + f * (PLATFORM - 2 * inset);
      const e = HALF - inset;
      if (side === 0) return [a, -e];
      if (side === 1) return [e, a];
      if (side === 2) return [-a, e];
      return [-e, -a];
    };
    for (let k = 0; k < 64; k++) {
      let t = rand() * 4;
      // köşelere yığılma
      if (rand() < 0.55) t = Math.round(t) + (rand() - 0.5) * 0.28;
      const [x, z] = perimeterPoint(((t % 4) + 4) % 4, 0.12 + rand() * bandMax);
      clumps.push({ x, z });
    }
    for (let i = 0; i < BLADES; i++) {
      const c = clumps[Math.floor(rand() * clumps.length)];
      const x = THREE.MathUtils.clamp(c.x + (rand() - 0.5) * 0.9, -HALF + 0.06, HALF - 0.06);
      const z = THREE.MathUtils.clamp(c.z + (rand() - 0.5) * 0.9, -HALF + 0.06, HALF - 0.06);
      const s = 0.55 + rand() * 0.95;
      dummy.position.set(x, 0.04, z);
      dummy.rotation.set((rand() - 0.5) * 0.55, rand() * Math.PI * 2, (rand() - 0.5) * 0.55);
      dummy.scale.set(0.8 + rand() * 0.6, s, 0.8 + rand() * 0.6);
      dummy.updateMatrix();
      grass.setMatrixAt(i, dummy.matrix);
      grassData.push({ r1: rand(), s });
    }
  }
  world.add(grass);

  /* ---------------------------------------------------------------- */
  /*  Gövde + dallar                                                   */
  /* ---------------------------------------------------------------- */
  const tree = new THREE.Group(); // rüzgârda sallanan grup
  world.add(tree);

  const trunkMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const barkTones = [new THREE.Color('#ffffff'), new THREE.Color('#e9d6c4'), new THREE.Color('#d7bda5')];

  function barkColors(geo, seed) {
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const n = Math.abs(Math.sin(pos.getX(i) * 9.1 + pos.getY(i) * 3.3 + pos.getZ(i) * 7.7 + seed)) * 2.99;
      const c = barkTones[Math.floor(n)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  const trunkGeo = new THREE.CylinderGeometry(0.2, 0.46, 4.3, 9, 7, true);
  {
    const p = trunkGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i);
      const ang = Math.atan2(p.getZ(i), p.getX(i));
      const bump = 1 + 0.12 * Math.sin(ang * 3 + y * 1.7) + 0.06 * Math.sin(ang * 7 + y * 4.1);
      const flare = y < -1.6 ? 1 + (-1.6 - y) * 0.2 : 1;
      p.setX(i, p.getX(i) * bump * flare + Math.sin(y * 0.9) * 0.05);
      p.setZ(i, p.getZ(i) * bump * flare + Math.cos(y * 0.8) * 0.05);
    }
    trunkGeo.translate(0, 2.15, 0);
    trunkGeo.computeVertexNormals();
    barkColors(trunkGeo, 1.3);
  }
  const trunk = new THREE.Mesh(trunkGeo, trunkMat);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  tree.add(trunk);

  const branchSpecs = [
    { y: 2.6, az: 0.4, tilt: 0.75, len: 1.7, r: 0.13 },
    { y: 3.0, az: 2.2, tilt: 0.7, len: 1.9, r: 0.13 },
    { y: 3.4, az: 3.9, tilt: 0.55, len: 1.8, r: 0.12 },
    { y: 3.8, az: 5.3, tilt: 0.5, len: 1.6, r: 0.1 },
    { y: 4.0, az: 1.3, tilt: 0.35, len: 1.7, r: 0.1 },
    { y: 4.3, az: 3.0, tilt: 0.3, len: 1.5, r: 0.09 },
  ];
  branchSpecs.forEach((b, i) => {
    const g = new THREE.CylinderGeometry(b.r * 0.5, b.r, b.len, 6, 1, true);
    g.translate(0, b.len / 2, 0);
    barkColors(g, i * 2.1);
    const m = new THREE.Mesh(g, trunkMat);
    m.position.set(0, b.y, 0);
    m.rotation.order = 'YXZ';
    m.rotation.y = b.az;
    m.rotation.x = b.tilt; // dışa doğru eğim
    m.castShadow = true;
    tree.add(m);
  });

  /* ---------------------------------------------------------------- */
  /*  Taç yapraklar (InstancedMesh)                                    */
  /* ---------------------------------------------------------------- */
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, -0.5);
  leafShape.bezierCurveTo(0.55, -0.25, 0.5, 0.3, 0, 0.55);
  leafShape.bezierCurveTo(-0.5, 0.3, -0.55, -0.25, 0, -0.5);
  const leafGeo = new THREE.ShapeGeometry(leafShape, 3);

  const leafMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  leafMat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `vec3 transformed = vec3(position);
         #ifdef USE_INSTANCING
           vec3 ip = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
         #else
           vec3 ip = vec3(0.0);
         #endif
         float w = sin(uTime * 1.5 + ip.x * 1.7 + ip.z * 1.3 + ip.y * 0.9);
         float a = w * 0.33;
         float cs = cos(a); float sn = sin(a);
         transformed.y = position.y * cs;
         transformed.z = position.y * sn;`
      );
  };

  const LEAVES = 3800;
  const leaves = new THREE.InstancedMesh(leafGeo, leafMat, LEAVES);
  leaves.castShadow = true;
  leaves.receiveShadow = false;
  leaves.frustumCulled = false;

  // Taç, birkaç elipsoidin birleşimi
  const lobes = [
    { c: [0, 5.3, 0], r: [2.65, 2.5, 2.65], w: 6 },
    { c: [-1.5, 4.1, 0.7], r: [1.7, 1.3, 1.7], w: 2.2 },
    { c: [1.55, 4.3, -0.6], r: [1.8, 1.4, 1.7], w: 2.2 },
    { c: [0.5, 3.7, 1.7], r: [1.4, 1.1, 1.4], w: 1.4 },
    { c: [-0.4, 3.9, -1.8], r: [1.5, 1.2, 1.4], w: 1.4 },
    { c: [0.2, 6.9, 0.1], r: [1.5, 1.0, 1.5], w: 1.6 },
  ];
  const lobeTotal = lobes.reduce((s, l) => s + l.w, 0);

  const leaf = {
    pos: new Float32Array(LEAVES * 3),
    quat: [],
    base: new Float32Array(LEAVES),
    delay: new Float32Array(LEAVES),
    r1: new Float32Array(LEAVES),
    r2: new Float32Array(LEAVES),
    r3: new Float32Array(LEAVES),
    h: new Float32Array(LEAVES), // 0..1 yükseklik
    fromCol: new Float32Array(LEAVES * 3),
    toCol: new Float32Array(LEAVES * 3),
    fromScale: new Float32Array(LEAVES),
    toScale: new Float32Array(LEAVES),
  };
  {
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < LEAVES; i++) {
      let pick = rand() * lobeTotal;
      let lobe = lobes[0];
      for (const l of lobes) {
        pick -= l.w;
        if (pick <= 0) {
          lobe = l;
          break;
        }
      }
      // birim küre içinde yüzeye yakın nokta
      let x, y, z;
      do {
        x = rand() * 2 - 1;
        y = rand() * 2 - 1;
        z = rand() * 2 - 1;
      } while (x * x + y * y + z * z > 1);
      const len = Math.hypot(x, y, z) || 1;
      const k = Math.pow(len, 0.45) / len; // yüzeye doğru it
      leaf.pos[i * 3] = lobe.c[0] + x * k * lobe.r[0];
      leaf.pos[i * 3 + 1] = lobe.c[1] + y * k * lobe.r[1];
      leaf.pos[i * 3 + 2] = lobe.c[2] + z * k * lobe.r[2];
      e.set(rand() * Math.PI * 2, rand() * Math.PI * 2, rand() * Math.PI * 2);
      leaf.quat.push(new THREE.Quaternion().setFromEuler(e));
      leaf.base[i] = 0.3 + rand() * 0.18;
      leaf.delay[i] = rand();
      leaf.r1[i] = rand();
      leaf.r2[i] = rand();
      leaf.r3[i] = rand();
      leaf.h[i] = THREE.MathUtils.clamp((leaf.pos[i * 3 + 1] - 2.2) / 5.6, 0, 1);
    }
  }

  const tmpColor = new THREE.Color();
  function leafTarget(season, i) {
    const S = SEASONS[season];
    // Konuma göre hafif renk bölgeleri + rastgelelik
    const bias = Math.sin(leaf.pos[i * 3] * 1.3 + leaf.pos[i * 3 + 2] * 0.9 + leaf.h[i] * 3.0) * 0.12;
    const r = THREE.MathUtils.clamp(leaf.r1[i] + bias, 0, 0.9999);
    tmpColor.set(weightedPick(S.leaves, r));
    // yukarıdaki yapraklar biraz daha açık
    tmpColor.offsetHSL(0, 0, (leaf.h[i] - 0.5) * 0.07 + (leaf.r2[i] - 0.5) * 0.04);
    const visible = leaf.r3[i] < S.density;
    return { color: tmpColor, scale: visible ? leaf.base[i] * S.size : 0.0001 };
  }

  const leafColorArr = leaves.instanceColor || null;
  // instanceColor oluşturmak için bir kez set et
  tmpColor.set('#6fc24b');
  for (let i = 0; i < LEAVES; i++) leaves.setColorAt(i, tmpColor);
  tree.add(leaves);

  const dummy = new THREE.Object3D();
  function writeLeaf(i, k) {
    const s = THREE.MathUtils.lerp(leaf.fromScale[i], leaf.toScale[i], k);
    dummy.position.set(leaf.pos[i * 3], leaf.pos[i * 3 + 1], leaf.pos[i * 3 + 2]);
    dummy.quaternion.copy(leaf.quat[i]);
    dummy.scale.setScalar(s);
    dummy.updateMatrix();
    leaves.setMatrixAt(i, dummy.matrix);
    tmpColor.setRGB(
      THREE.MathUtils.lerp(leaf.fromCol[i * 3], leaf.toCol[i * 3], k),
      THREE.MathUtils.lerp(leaf.fromCol[i * 3 + 1], leaf.toCol[i * 3 + 1], k),
      THREE.MathUtils.lerp(leaf.fromCol[i * 3 + 2], leaf.toCol[i * 3 + 2], k)
    );
    leaves.instanceColor.setXYZ(i, tmpColor.r, tmpColor.g, tmpColor.b);
  }

  /* --- çimen renk geçişi için ara veri --- */
  const grassFrom = new Float32Array(BLADES * 3);
  const grassTo = new Float32Array(BLADES * 3);
  const grassColor = new THREE.Color();
  for (let i = 0; i < BLADES; i++) grass.setColorAt(i, grassColor.set('#5fbf3a'));

  /* ---------------------------------------------------------------- */
  /*  Düşen yapraklar                                                  */
  /* ---------------------------------------------------------------- */
  const FALL_MAX = 44;
  const fallGeo = leafGeo.clone();
  const fallMat = new THREE.MeshLambertMaterial({ color: '#ffffff', side: THREE.DoubleSide });
  const falling = new THREE.InstancedMesh(fallGeo, fallMat, FALL_MAX);
  falling.frustumCulled = false;
  for (let i = 0; i < FALL_MAX; i++) falling.setColorAt(i, tmpColor.set('#86d257'));
  world.add(falling);
  const fall = Array.from({ length: FALL_MAX }, () => ({
    x: 0, y: -5, z: 0, vy: 0, ph: rand() * 6.28, sp: rand(), spin: rand() * 2 + 1, size: 0.2 + rand() * 0.12,
  }));
  let fallActive = 10;
  function respawn(f, initial) {
    const a = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 2.4;
    f.x = Math.cos(a) * rr;
    f.z = Math.sin(a) * rr;
    f.y = initial ? 0.3 + rand() * 6.5 : 3.2 + rand() * 3.5;
    f.vy = 0.35 + rand() * 0.35;
    f.ph = rand() * 6.28;
  }
  fall.forEach((f) => respawn(f, true));

  /* ---------------------------------------------------------------- */
  /*  Kelebekler                                                       */
  /* ---------------------------------------------------------------- */
  const butterflies = [];
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, 0.16, 0.1, 0.02, 0.15, -0.08, 0.0]), 3));
  wingGeo.setIndex([0, 1, 2]);
  wingGeo.computeVertexNormals();
  ['#a9dcff', '#ffb6e6', '#ffe58a'].forEach((c, i) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide });
    const wl = new THREE.Mesh(wingGeo, mat);
    const wr = new THREE.Mesh(wingGeo, mat);
    wr.scale.x = -1;
    g.add(wl, wr);
    g.userData = { wl, wr, seed: i * 2.4 + 0.7, rx: 2.1 + i * 0.5, rz: 1.8 + i * 0.35, cy: 0.9 + i * 0.5, sp: 0.35 + i * 0.1 };
    world.add(g);
    butterflies.push(g);
  });

  /* ---------------------------------------------------------------- */
  /*  Tıklama alanı                                                    */
  /* ---------------------------------------------------------------- */
  const hit = new THREE.Mesh(new THREE.SphereGeometry(3.1, 12, 10), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(0, 5.0, 0);
  const hitTrunk = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.8, 4.5, 8), new THREE.MeshBasicMaterial({ visible: false }));
  hitTrunk.position.set(0, 2.2, 0);
  world.add(hit, hitTrunk);
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function hitsTree(ev) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
    raycaster.setFromCamera(ndc, camera);
    return raycaster.intersectObjects([hit, hitTrunk], false).length > 0;
  }

  let down = null;
  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY, t: performance.now() }));
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const dt = performance.now() - down.t;
    down = null;
    if (moved < 8 && dt < 600 && hitsTree(e)) onTap?.();
  });
  let yawTarget = 0;
  el.addEventListener('pointermove', (e) => {
    const r = el.getBoundingClientRect();
    yawTarget = (((e.clientX - r.left) / r.width) * 2 - 1) * 0.12;
    if (e.pointerType === 'mouse') el.style.cursor = hitsTree(e) ? 'pointer' : 'default';
  });
  el.addEventListener('pointerleave', () => (yawTarget = 0));

  /* ---------------------------------------------------------------- */
  /*  Boyutlandırma: ağacı kadraja sığdır                              */
  /* ---------------------------------------------------------------- */
  const fitPoints = [];
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      fitPoints.push(new THREE.Vector3(sx * HALF, -0.55, sz * HALF));
      fitPoints.push(new THREE.Vector3(sx * HALF, 1.0, sz * HALF));
    }
  for (let a = 0; a < 12; a++) {
    const an = (a / 12) * Math.PI * 2;
    fitPoints.push(new THREE.Vector3(Math.cos(an) * 2.2, 7.3, Math.sin(an) * 2.2));
    fitPoints.push(new THREE.Vector3(Math.cos(an) * 2.9, 5.3, Math.sin(an) * 2.9));
  }
  fitPoints.push(new THREE.Vector3(0, 8.0, 0));
  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setSize(w, h, false);
    el.style.width = w + 'px';
    el.style.height = h + 'px';

    camera.updateMatrixWorld();
    const inv = camera.matrixWorldInverse;
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const v = new THREE.Vector3();
    for (const p of fitPoints) {
      v.copy(p).applyMatrix4(inv);
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    }
    const bw = maxX - minX;
    const bh = maxY - minY;
    const pad = 1.04;
    const scale = Math.min(w / (bw * pad), h / (bh * pad)); // piksel / birim
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    camera.left = cx - w / 2 / scale;
    camera.right = cx + w / 2 / scale;
    camera.top = cy + h / 2 / scale;
    camera.bottom = cy - h / 2 / scale;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  /* ---------------------------------------------------------------- */
  /*  Mevsim geçişi                                                    */
  /* ---------------------------------------------------------------- */
  let season = 'summer';
  let transStart = -10;
  const TRANS = 1.5;
  let transitioning = false;

  function applySeason(next, instant = false) {
    const S = SEASONS[next];
    // yapraklar: mevcut değerleri 'from' yap, hedefi hesapla
    for (let i = 0; i < LEAVES; i++) {
      const cur = instant ? null : currentLeafState(i);
      const tgt = leafTarget(next, i);
      if (cur) {
        leaf.fromCol[i * 3] = cur.r; leaf.fromCol[i * 3 + 1] = cur.g; leaf.fromCol[i * 3 + 2] = cur.b;
        leaf.fromScale[i] = cur.s;
      } else {
        leaf.fromCol[i * 3] = tgt.color.r; leaf.fromCol[i * 3 + 1] = tgt.color.g; leaf.fromCol[i * 3 + 2] = tgt.color.b;
        leaf.fromScale[i] = tgt.scale;
      }
      leaf.toCol[i * 3] = tgt.color.r; leaf.toCol[i * 3 + 1] = tgt.color.g; leaf.toCol[i * 3 + 2] = tgt.color.b;
      leaf.toScale[i] = tgt.scale;
    }
    // çimen
    for (let i = 0; i < BLADES; i++) {
      const c = new THREE.Color(S.grass[Math.floor(grassData[i].r1 * S.grass.length) % S.grass.length]);
      c.offsetHSL(0, 0, (grassData[i].r1 - 0.5) * 0.08);
      if (instant) {
        grassFrom[i * 3] = c.r; grassFrom[i * 3 + 1] = c.g; grassFrom[i * 3 + 2] = c.b;
      } else {
        grass.getColorAt(i, grassColor);
        grassFrom[i * 3] = grassColor.r; grassFrom[i * 3 + 1] = grassColor.g; grassFrom[i * 3 + 2] = grassColor.b;
      }
      grassTo[i * 3] = c.r; grassTo[i * 3 + 1] = c.g; grassTo[i * 3 + 2] = c.b;
    }
    // gövde rengi
    trunkMat.color.set(S.trunk);
    // düşen yapraklar
    fallActive = S.fallCount;
    for (let i = 0; i < FALL_MAX; i++) {
      falling.setColorAt(i, tmpColor.set(S.falling[i % S.falling.length]));
    }
    falling.instanceColor.needsUpdate = true;

    season = next;
    transStart = instant ? -10 : clock.getElapsedTime();
    transitioning = true;
    if (instant) transStart = clock.getElapsedTime() - TRANS - 1;
  }

  function currentLeafState(i) {
    leaves.getColorAt(i, tmpColor);
    // getColorAt linear döner; scale matristen okunur
    leaves.getMatrixAt(i, m4);
    const s = m4.elements[0] !== undefined ? new THREE.Vector3().setFromMatrixColumn(m4, 0).length() : 0.3;
    return { r: tmpColor.r, g: tmpColor.g, b: tmpColor.b, s };
  }

  const grassScaleNow = { v: 1, from: 1, to: 1 };
  const grassBaseMatrices = [];
  for (let i = 0; i < BLADES; i++) {
    const mm = new THREE.Matrix4();
    grass.getMatrixAt(i, mm);
    grassBaseMatrices.push(mm);
  }
  const gDummy = new THREE.Object3D();
  const gp = new THREE.Vector3(), gq = new THREE.Quaternion(), gs = new THREE.Vector3();
  function writeGrass(i, k) {
    grassColor.setRGB(
      THREE.MathUtils.lerp(grassFrom[i * 3], grassTo[i * 3], k),
      THREE.MathUtils.lerp(grassFrom[i * 3 + 1], grassTo[i * 3 + 1], k),
      THREE.MathUtils.lerp(grassFrom[i * 3 + 2], grassTo[i * 3 + 2], k)
    );
    grass.setColorAt(i, grassColor);
    grassBaseMatrices[i].decompose(gp, gq, gs);
    gDummy.position.copy(gp);
    gDummy.quaternion.copy(gq);
    gDummy.scale.set(gs.x, gs.y * grassScaleNow.v, gs.z);
    gDummy.updateMatrix();
    grass.setMatrixAt(i, gDummy.matrix);
  }

  /* ---------------------------------------------------------------- */
  /*  Döngü                                                            */
  /* ---------------------------------------------------------------- */
  const clock = new THREE.Clock();
  let pulseAt = -10;
  let raf = 0;
  const tmpMat = new THREE.Matrix4();
  const fallDummy = new THREE.Object3D();

  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    uniforms.uTime.value = reduceMotion ? 0 : t;

    // mevsim geçişi
    if (transitioning) {
      const elapsed = t - transStart;
      let done = true;
      const sc = SEASONS[season].grassScale;
      grassScaleNow.v = THREE.MathUtils.lerp(grassScaleNow.from, sc, smooth(elapsed / TRANS));
      for (let i = 0; i < LEAVES; i++) {
        const k = smooth((elapsed - leaf.delay[i] * 0.55) / 0.9);
        if (k < 1) done = false;
        writeLeaf(i, k);
      }
      for (let i = 0; i < BLADES; i++) writeGrass(i, smooth(elapsed / TRANS));
      leaves.instanceMatrix.needsUpdate = true;
      leaves.instanceColor.needsUpdate = true;
      grass.instanceMatrix.needsUpdate = true;
      grass.instanceColor.needsUpdate = true;
      if (done && elapsed > TRANS) {
        transitioning = false;
        grassScaleNow.from = sc;
      }
    }

    // sallanma
    if (!reduceMotion) {
      tree.rotation.z = Math.sin(t * 0.55) * 0.011;
      tree.rotation.x = Math.cos(t * 0.43) * 0.009;
    }
    const p = Math.max(0, 1 - (t - pulseAt) / 0.7);
    const pulse = 1 + Math.sin(p * Math.PI) * 0.035 * p;
    tree.scale.set(pulse, pulse, pulse);
    world.rotation.y += (yawTarget - world.rotation.y) * Math.min(1, dt * 3);

    // düşen yapraklar
    for (let i = 0; i < FALL_MAX; i++) {
      const f = fall[i];
      if (i >= fallActive) {
        fallDummy.scale.setScalar(0.0001);
        fallDummy.position.set(0, -10, 0);
      } else {
        f.y -= f.vy * dt;
        f.ph += dt * (1.3 + f.sp);
        f.x += Math.sin(f.ph) * 0.22 * dt + 0.1 * dt;
        f.z += Math.cos(f.ph * 0.8) * 0.18 * dt;
        if (f.y < 0.12) respawn(f, false);
        const fade = Math.min(1, (f.y - 0.12) / 0.5);
        fallDummy.position.set(f.x, f.y, f.z);
        fallDummy.rotation.set(f.ph * f.spin, f.ph * 0.7, Math.sin(f.ph) * 1.2);
        fallDummy.scale.setScalar(f.size * Math.max(0.0001, fade));
      }
      fallDummy.updateMatrix();
      falling.setMatrixAt(i, fallDummy.matrix);
    }
    falling.instanceMatrix.needsUpdate = true;

    // kelebekler
    for (const b of butterflies) {
      const d = b.userData;
      const a = t * d.sp + d.seed;
      b.position.set(Math.cos(a) * d.rx + Math.sin(a * 2.3) * 0.3, d.cy + Math.sin(a * 1.7 + d.seed) * 0.35, Math.sin(a) * d.rz);
      b.rotation.y = -a + Math.PI / 2;
      const flap = Math.sin(t * 14 + d.seed) * 0.9;
      d.wl.rotation.z = flap;
      d.wr.rotation.z = -flap;
      b.visible = season !== 'autumn';
      b.scale.setScalar(season === 'spring' ? 1.25 : 1);
    }

    renderer.render(scene, camera);
  }

  // ilk durum
  applySeason('summer', true);
  grassScaleNow.v = grassScaleNow.from = SEASONS.summer.grassScale;
  for (let i = 0; i < LEAVES; i++) writeLeaf(i, 1);
  for (let i = 0; i < BLADES; i++) writeGrass(i, 1);
  leaves.instanceMatrix.needsUpdate = true;
  leaves.instanceColor.needsUpdate = true;
  grass.instanceMatrix.needsUpdate = true;
  grass.instanceColor.needsUpdate = true;
  transitioning = false;
  frame();

  return {
    setSeason(next) {
      if (next === season || !SEASONS[next]) return;
      grassScaleNow.from = grassScaleNow.v;
      applySeason(next);
    },
    pulse() {
      pulseAt = clock.elapsedTime;
    },
    get season() {
      return season;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      el.remove();
    },
  };
}
