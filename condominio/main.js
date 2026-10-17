import * as THREE from 'three';

/* ================= Configuração ================= */
const C = {
  wall: '#EDC6AC', tower: '#E7A89A', trim: '#F6ECDD', roof: '#C4673F', wood: '#7A4A2E',
  glass: '#2C4655', paving: '#E9D7BD', sand: '#E1CBA5', lawn: '#6FA65A', hedge: '#3F7A3A',
  umbrella: '#6E906A', stone: '#D8C6AC', water: '#35BFD6', lounger: '#F2EEE6', street: '#6E6A66'
};
const H = 9.6;                       // altura dos prédios (3 pisos)
const touch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
if (touch) document.body.classList.add('touch');
if (touch) document.getElementById('hint').textContent = 'Joystick para andar · arrastar para olhar · tocar no chão para ir';
if (touch) document.getElementById('keys').innerHTML = '<span>joystick para andar</span><span>arrastar para olhar</span><span>tocar no chão para ir</span>';

/* ================= Renderer / cena ================= */
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, touch ? 1.5 : 1.75));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#CFE8EE', 70, 260);
const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 600);
camera.rotation.order = 'YXZ';

const hemi = new THREE.HemisphereLight('#DFF3FF', '#C9A97E', 0.85);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#FFE8C8', 2.4);
sun.position.set(40, 60, 25);
sun.castShadow = true;
sun.shadow.mapSize.set(touch ? 1024 : 2048, touch ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 75, bottom: -75, near: 10, far: 180 });
sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04;
scene.add(sun);

/* céu em degradé */
const skyGeo = new THREE.SphereGeometry(400, 24, 12);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: { top: { value: new THREE.Color('#6FC2E0') }, bottom: { value: new THREE.Color('#F4E3C8') } },
  vertexShader: 'varying vec3 vP; void main(){ vP = (modelMatrix*vec4(position,1.0)).xyz; gl_Position = projectionMatrix*viewMatrix*vec4(vP,1.0); }',
  fragmentShader: 'uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(normalize(vP).y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(bottom,top,h),1.0); }'
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

const mats = {};
function mat(color, opts = {}) {
  const k = color + JSON.stringify(opts);
  return mats[k] || (mats[k] = new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true, ...opts }));
}
function box(w, h, d, color, x, y, z, opts = {}) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), opts.material || mat(color));
  m.position.set(x, y, z); m.castShadow = opts.cast !== false; m.receiveShadow = true;
  scene.add(m); return m;
}

/* ================= Colisões ================= */
const boxes = [];   // {x0,x1,z0,z1}
const circles = []; // {x,z,r}
function solid(x0, x1, z0, z1) { boxes.push({ x0: Math.min(x0, x1), x1: Math.max(x0, x1), z0: Math.min(z0, z1), z1: Math.max(z0, z1) }); }

/* ================= Chão ================= */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(900, 900), mat(C.sand));
ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
const paving = new THREE.Mesh(new THREE.PlaneGeometry(59, 88), mat(C.paving, { roughness: 0.95 }));
paving.rotation.x = -Math.PI / 2; paving.position.set(5.5, 0.01, 0); paving.receiveShadow = true; scene.add(paving);
const street = new THREE.Mesh(new THREE.PlaneGeometry(9, 220), mat(C.street, { roughness: 1 }));
street.rotation.x = -Math.PI / 2; street.position.set(47, 0.012, 0); street.receiveShadow = true; scene.add(street);
const sidewalk = new THREE.Mesh(new THREE.PlaneGeometry(3, 220), mat('#D9CBB4'));
sidewalk.rotation.x = -Math.PI / 2; sidewalk.position.set(41, 0.014, 0); scene.add(sidewalk);
const groundClick = [ground, paving, street, sidewalk];

/* mar ao longe (a sul) */
const sea = new THREE.Mesh(new THREE.PlaneGeometry(900, 300), new THREE.MeshStandardMaterial({ color: '#2FB3C8', roughness: 0.25, metalness: 0.1 }));
sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.03, 260); scene.add(sea);

/* ================= Edifícios ================= */
const inst = { win: [], winLit: [], balc: [], latt: [], merlon: [], crown: [], panel: [] };
const M4 = () => new THREE.Matrix4();
function put(list, x, y, z, sx, sy, sz, rotY = 0) {
  const m = M4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotY), new THREE.Vector3(sx, sy, sz));
  list.push(m);
}
function gableRoof(len, width, x, z, alongX) {
  const s = new THREE.Shape();
  s.moveTo(-width / 2 - 0.5, 0); s.lineTo(width / 2 + 0.5, 0); s.lineTo(0, 2.3); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: len + 0.6, bevelEnabled: false });
  g.translate(0, 0, -(len + 0.6) / 2);
  if (alongX) g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(C.roof, { roughness: 0.9 }));
  m.position.set(x, H, z); m.castShadow = true; m.receiveShadow = true; scene.add(m);
}
/* fachada: lado virado para o pátio. dir = normal da fachada (+1/-1) e eixo */
function facade(axis, fixed, from, to, dir) {
  const rot = axis === 'x' ? (dir > 0 ? 0 : Math.PI) : (dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  const P = (a, y, off) => axis === 'x' ? [a, y, fixed + dir * off] : [fixed + dir * off, y, a];
  let k = 0;
  for (let a = from + 3; a < to - 2; a += 4.2, k++) {
    const isTower = k % 3 === 1;
    if (isTower) {
      const [tx, , tz] = P(a, 0, 0.7);
      put(inst.merlon, tx, (H + 2.4) / 2, tz, 2.6, H + 2.4, 1.4, rot);
      const [cx, , cz] = P(a, 0, 0.7);
      put(inst.crown, cx + (axis === 'x' ? -0.9 : 0), H + 2.4 + 0.6, cz + (axis === 'x' ? 0 : -0.9), 0.8, 1.2, 1.4, rot);
      put(inst.crown, cx + (axis === 'x' ? 0.9 : 0), H + 2.4 + 0.6, cz + (axis === 'x' ? 0 : 0.9), 0.8, 1.2, 1.4, rot);
      const [lx, , lz] = P(a, 0, 1.42);
      put(inst.latt, lx, 5.6, lz, 1.7, 6.4, 0.08, rot);
      continue;
    }
    for (let f = 0; f < 3; f++) {
      const y = 1.6 + f * 3.1;
      const [wx, , wz] = P(a, 0, 0.06);
      put(Math.random() < 0.55 ? inst.winLit : inst.win, wx, y, wz, 1.5, 1.9, 0.12, rot);
      if (f > 0) {
        const [bx, , bz] = P(a, 0, 0.65);
        put(inst.balc, bx, y - 1.05, bz, 2.8, 0.25, 1.3, rot);
        const [rx, , rz] = P(a, 0, 1.28);
        put(inst.latt, rx, y - 0.45, rz, 2.8, 0.95, 0.06, rot);
      }
    }
    if (k % 6 === 4) { const [px, , pz] = P(a, 0, 0.05); put(inst.panel, px, 4.5, pz, 1.4, 7.5, 0.1, rot); }
  }
}
function wing(x0, x1, z0, z1, alongX, face) {
  const w = x1 - x0, d = z1 - z0;
  box(w, H, d, C.wall, (x0 + x1) / 2, H / 2, (z0 + z1) / 2);
  box(w + 0.3, 0.35, d + 0.3, C.trim, (x0 + x1) / 2, H, (z0 + z1) / 2);
  gableRoof(alongX ? w : d, alongX ? d : w, (x0 + x1) / 2, (z0 + z1) / 2, alongX);
  face();
  solid(x0, x1, z0, z1);
}
wing(-35, -24, -55, 55, false, () => facade('z', -24, -44, 44, 1));
wing(-24, 10, -55, -44, true, () => facade('x', -44, -24, 10, 1));
wing(-24, 35, 44, 55, true, () => facade('x', 44, -24, 35, -1));
/* edifício de receção / restaurante (telhado plano cinzento, com ameias) */
box(25, 7.5, 15, C.wall, 22.5, 3.75, -47.5);
box(25.4, 0.5, 15.4, '#B9B4AC', 22.5, 7.6, -47.5);
for (let x = 11; x <= 34; x += 3.2) put(inst.crown, x, 8.3, -39.9, 1.2, 1.4, 0.6, 0);
for (let x = 12; x <= 33; x += 4.2) { put(inst.win, x, 2.2, -39.94, 2.6, 2.6, 0.12, 0); put(inst.win, x, 5.4, -39.94, 1.6, 1.6, 0.12, 0); }
solid(10, 35, -55, -40);

/* muro a nascente + arcada de entrada "Tropical" */
box(0.8, 2.4, 36, C.trim, 35, 1.2, -22); solid(34.6, 35.4, -40, -4);
box(0.8, 2.4, 28, C.trim, 35, 1.2, 30); solid(34.6, 35.4, 16, 44);
(function arcade() {
  const s = new THREE.Shape();
  s.moveTo(-10, 0);
  [-6, 0, 6].forEach((c) => { s.lineTo(c - 1.8, 0); s.lineTo(c - 1.8, 2.5); s.absarc(c, 2.5, 1.8, Math.PI, 0, true); s.lineTo(c + 1.8, 0); });
  s.lineTo(10, 0); s.lineTo(10, 5); s.lineTo(-10, 5); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 4, bevelEnabled: false });
  g.rotateY(Math.PI / 2);
  const m = new THREE.Mesh(g, mat(C.wall)); m.position.set(35, 0, 6); m.castShadow = m.receiveShadow = true; scene.add(m);
  [[-4, -1.8], [1.8, 4.2], [7.8, 10.2], [13.8, 16]].forEach(([a, b]) => solid(35, 39, a, b));
  // ameias por cima da arcada
  for (let z = -3.4; z <= 15.4; z += 2.6) box(4.1, 0.9, 1, C.wall, 37, 5.45, z);
  // letreiro
  function sign(x, rot) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 160;
    const c = cv.getContext('2d'); c.fillStyle = '#ffffff'; c.font = 'italic 110px Georgia, serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText('Tropical', 256, 86);
    const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.9), new THREE.MeshBasicMaterial({ map: t, transparent: true }));
    p.position.set(x, 3.95, 6); p.rotation.y = rot; scene.add(p);
  }
  sign(39.06, Math.PI / 2); sign(34.94, -Math.PI / 2);
})();

/* instâncias das fachadas */
const panelTex = (() => {
  const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const c = cv.getContext('2d');
  const cols = ['#F2E3B3', '#A9D6C8', '#E9C46A', '#F6EFE2'];
  for (let y = 0; y < 256; y += 32) for (let x = 0; x < 64; x += 32) {
    c.fillStyle = cols[(x + y) / 32 % 4]; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 32, y); c.lineTo(x + 16, y + 32); c.fill();
    c.fillStyle = cols[(x + y + 64) / 32 % 4]; c.beginPath(); c.moveTo(x, y + 32); c.lineTo(x + 32, y + 32); c.lineTo(x + 16, y); c.fill();
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
})();
const winMat = new THREE.MeshStandardMaterial({ color: C.glass, roughness: 0.25, metalness: 0.3 });
const winLitMat = new THREE.MeshStandardMaterial({ color: C.glass, roughness: 0.25, metalness: 0.3, emissive: '#FFC47A', emissiveIntensity: 0 });
const instMeshes = [];
function instanced(list, material, cast = true) {
  if (!list.length) return null;
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), material, list.length);
  list.forEach((m, i) => im.setMatrixAt(i, m));
  im.castShadow = cast; im.receiveShadow = true; scene.add(im); instMeshes.push(im); return im;
}
instanced(inst.win, winMat, false);
instanced(inst.winLit, winLitMat, false);
instanced(inst.balc, mat(C.trim));
instanced(inst.latt, mat(C.wood, { roughness: 0.7 }));
instanced(inst.merlon, mat(C.tower));
instanced(inst.crown, mat(C.tower));
instanced(inst.panel, new THREE.MeshStandardMaterial({ map: panelTex, roughness: 0.8 }), false);

/* ================= Piscina ================= */
const poolPts = [[-4, -15], [4, -14.5], [8, -9], [7.5, -3], [3.5, 1.5], [2.5, 5.5], [5.5, 9.5], [6, 13.5], [2, 16.5], [-5, 15.5], [-8.5, 10], [-8.5, 3], [-6.5, -3], [-8.5, -9]]
  .map(([x, z]) => new THREE.Vector2(x + 1, z - 2));
const poolCurve = new THREE.SplineCurve([...poolPts, poolPts[0]]);
const poolPoly = poolCurve.getSpacedPoints(80);
function shapeFrom(pts, grow) {
  const c = pts.reduce((a, p) => a.add(p), new THREE.Vector2()).divideScalar(pts.length);
  const s = new THREE.Shape(pts.map((p) => p.clone().sub(c).multiplyScalar(1 + grow / 9).add(c)));
  return s;
}
const coping = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(poolPoly, 0.9), 1), mat('#F3EBDD', { side: THREE.DoubleSide }));
coping.rotation.x = Math.PI / 2; coping.position.y = 0.05; coping.receiveShadow = true; scene.add(coping);
const blueRim = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(poolPoly, 0.35), 1), mat('#2E7FC0', { side: THREE.DoubleSide }));
blueRim.rotation.x = Math.PI / 2; blueRim.position.y = 0.06; scene.add(blueRim);
const waterMat = new THREE.MeshStandardMaterial({ color: C.water, roughness: 0.12, metalness: 0.15, emissive: '#0FB5D0', emissiveIntensity: 0.12, transparent: true, opacity: 0.94, side: THREE.DoubleSide });
const water = new THREE.Mesh(new THREE.ShapeGeometry(shapeFrom(poolPoly, 0), 1), waterMat);
water.rotation.x = Math.PI / 2; water.position.y = 0.07; scene.add(water);
function inPool(x, z, margin = 0.5) {
  // ponto dentro do polígono (alargado)
  let inside = false; const pts = poolPoly;
  const c = new THREE.Vector2(); pts.forEach((p) => c.add(p)); c.divideScalar(pts.length);
  const px = c.x + (x - c.x) / (1 + margin / 9), pz = c.y + (z - c.y) / (1 + margin / 9);
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if (((a.y > pz) !== (b.y > pz)) && (px < (b.x - a.x) * (pz - a.y) / (b.y - a.y) + a.x)) inside = !inside;
  }
  return inside;
}
/* jacuzzi */
const tub = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 0.5, 20), mat('#F3EBDD')); tub.position.set(13, 0.25, 9); tub.castShadow = tub.receiveShadow = true; scene.add(tub);
const tubW = new THREE.Mesh(new THREE.CircleGeometry(1.35, 20), waterMat); tubW.rotation.x = -Math.PI / 2; tubW.position.set(13, 0.51, 9); scene.add(tubW);
circles.push({ x: 13, z: 9, r: 1.8 });

/* ================= Jardins ================= */
function lawn(x, z, w, d) { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(C.lawn, { roughness: 1 })); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); m.receiveShadow = true; scene.add(m); }
lawn(-17.5, -6, 11, 46); lawn(-17.5, 30, 11, 18); lawn(22, 28, 20, 12); lawn(-8, -36, 22, 10);
function hedge(x, z, w, d) { box(w, 0.9, d, C.hedge, x, 0.45, z); solid(x - w / 2, x + w / 2, z - d / 2, z + d / 2); }
hedge(-12, -18, 0.9, 16); hedge(-12, 6, 0.9, 14); hedge(-12, 30, 0.9, 12); hedge(22, 21.6, 18, 0.9); hedge(-8, -31.2, 20, 0.9);
/* arbustos com flores (instanciados) */
const bushM = [], flowerM = [];
const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
function bushRow(x0, z0, x1, z1, n) {
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, s = 0.7 + rnd() * 0.5;
    put(bushM, x, 0.5 * s, z, s * 1.4, s, s * 1.4);
    for (let k = 0; k < 4; k++) put(flowerM, x + (rnd() - 0.5) * s * 1.3, 0.75 * s + rnd() * 0.3, z + (rnd() - 0.5) * s * 1.3, 0.18, 0.18, 0.18);
  }
}
bushRow(-22.5, -40, -22.5, 40, 22); bushRow(-20, 42.5, 32, 42.5, 20); bushRow(-20, -42.5, 8, -42.5, 10); bushRow(33.5, -36, 33.5, -6, 9); bushRow(33.5, 18, 33.5, 40, 7);
const bushIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#4E8A45'), bushM.length); bushM.forEach((m, i) => bushIM.setMatrixAt(i, m)); bushIM.castShadow = true; scene.add(bushIM);
const flIM = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#EF6F8E', { roughness: 0.6 }), flowerM.length);
flowerM.forEach((m, i) => { flIM.setMatrixAt(i, m); flIM.setColorAt(i, new THREE.Color(['#EF6F8E', '#F2A3C0', '#F7F0F0', '#B48AE0'][i % 4])); }); scene.add(flIM);

/* palmeiras */
const trunkM = [], leafM = [];
const leafGeo = (() => {
  const g = new THREE.BufferGeometry(), v = [], n = 7;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = t * 3.4, y = 0.9 * t - 1.9 * t * t, w = 0.55 * Math.sin(Math.PI * Math.min(1, t * 1.15));
    v.push(x, y, -w, x, y, w);
  }
  const idx = []; for (let i = 0; i < n; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
})();
function palm(x, z, h = 7 + rnd() * 3) {
  const lean = (rnd() - 0.5) * 0.25;
  const m = M4().compose(new THREE.Vector3(x, h / 2, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(lean, 0, lean)), new THREE.Vector3(1, h, 1));
  trunkM.push(m);
  const top = new THREE.Vector3(x + Math.sin(lean) * h / 2 * 0.0, h, z);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * Math.PI * 2 + rnd() * 0.3, s = 0.85 + rnd() * 0.35;
    leafM.push(M4().compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, a, (rnd() - 0.3) * 0.35)), new THREE.Vector3(s, s, s)));
  }
  circles.push({ x, z, r: 0.45 });
}
[[-15, -36], [-19, -20], [-15, -4], [-20, 10], [-16, 24], [-19, 38], [10, -32], [26, -32], [31, -20], [30, -3], [24, 34], [8, 36], [-4, 38], [17, 16],
 [42, -30], [42, -14], [42, 20], [42, 36], [52, -24], [52, 0], [52, 26]].forEach(([x, z]) => palm(x, z));
const trunkGeo = new THREE.CylinderGeometry(0.17, 0.3, 1, 7); trunkGeo.translate(0, 0, 0);
const trIM = new THREE.InstancedMesh(trunkGeo, mat('#9C7A58'), trunkM.length); trunkM.forEach((m, i) => trIM.setMatrixAt(i, m)); trIM.castShadow = true; scene.add(trIM);
const lfIM = new THREE.InstancedMesh(leafGeo, mat('#4F9A4A', { side: THREE.DoubleSide, roughness: 0.7 }), leafM.length);
leafM.forEach((m, i) => { lfIM.setMatrixAt(i, m); lfIM.setColorAt(i, new THREE.Color(i % 3 ? '#4F9A4A' : '#6DB35A')); }); lfIM.castShadow = true; scene.add(lfIM);

/* guarda-sóis */
function umbrella(x, z) {
  box(0.12, 2.6, 0.12, '#EDE5D8', x, 1.3, z);
  const c = new THREE.Mesh(new THREE.ConeGeometry(2.4, 0.9, 10), mat(C.umbrella)); c.position.set(x, 2.9, z); c.castShadow = true; scene.add(c);
  circles.push({ x, z, r: 0.3 });
}
[[10, -10], [12, -3], [8, -22], [-2, -24], [20, -6], [18, 2]].forEach(([x, z]) => umbrella(x, z));

/* espreguiçadeiras */
function lounger(x, z, rot = 0) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.32, 1.7), mat(C.lounger)); base.position.y = 0.32; base.castShadow = true;
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.08, 0.8), mat(C.lounger)); back.position.set(0, 0.65, -0.95); back.rotation.x = -0.9; back.castShadow = true;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 1.8), mat(C.wood)); frame.position.y = 0.12;
  g.add(base, back, frame); g.position.set(x, 0, z); g.rotation.y = rot; scene.add(g);
}
for (let z = -12; z <= 12; z += 2.4) lounger(-10.2, z, Math.PI / 2);
for (let x = -6; x <= 8; x += 1.6) lounger(x, 25.5, 0);
for (let x = -2; x <= 6; x += 1.6) lounger(x, -21, Math.PI);

/* pérgolas */
function pergola(x0, z0, w, d) {
  const posts = [];
  for (let x = x0; x <= x0 + w + 0.01; x += w / 3) for (const z of [z0, z0 + d]) { box(0.22, 2.7, 0.22, C.wood, x, 1.35, z); posts.push([x, z]); }
  box(w + 0.6, 0.18, 0.22, C.wood, x0 + w / 2, 2.75, z0); box(w + 0.6, 0.18, 0.22, C.wood, x0 + w / 2, 2.75, z0 + d);
  for (let x = x0 - 0.2; x <= x0 + w + 0.2; x += 0.55) box(0.1, 0.14, d + 0.6, C.wood, x, 2.9, z0 + d / 2);
  posts.forEach(([x, z]) => circles.push({ x, z, r: 0.25 }));
}
pergola(-7, 23.5, 15, 4.2); pergola(20, -14, 9, 4); pergola(-10, -40, 9, 4);

/* bar da piscina (quiosque octogonal) */
(function bar() {
  const b = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 2.8, 8), mat(C.stone)); b.position.set(16, 1.4, -22); b.castShadow = b.receiveShadow = true; scene.add(b);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(4.05, 4.05, 1.0, 8, 1, true), mat('#3A2A20')); band.position.set(16, 2.1, -22); scene.add(band);
  const r = new THREE.Mesh(new THREE.ConeGeometry(5.6, 2.6, 8), mat('#6E906A')); r.position.set(16, 4.1, -22); r.castShadow = true; scene.add(r);
  const r2 = new THREE.Mesh(new THREE.ConeGeometry(1.4, 1.2, 8), mat('#6E906A')); r2.position.set(16, 5.6, -22); r2.castShadow = true; scene.add(r2);
  circles.push({ x: 16, z: -22, r: 4.5 });
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; box(0.5, 0.75, 0.5, '#E9A23B', 16 + Math.cos(a) * 5.2, 0.38, -22 + Math.sin(a) * 5.2); }
})();

/* cidade à volta (silhuetas) e candeeiros da rua */
const town = ['#F4EEE4', '#EAD9C4', '#F1C9B0', '#D9E6E3', '#F6E7C9'];
for (let i = 0; i < 70; i++) {
  const a = rnd() * Math.PI * 2, r = 95 + rnd() * 110, x = Math.cos(a) * r, z = Math.sin(a) * r;
  if (z > 110) continue;
  const w = 6 + rnd() * 14, h = 3 + rnd() * 7;
  box(w, h, 6 + rnd() * 12, town[i % 5], x, h / 2, z, { cast: false });
}
const lampPos = [[42.5, -20], [42.5, 0], [42.5, 20], [-6, -14], [9, 14], [-9, 18], [6, -16], [24, 12], [-14, -28]];
const bulbMat = new THREE.MeshStandardMaterial({ color: '#FFF1D6', emissive: '#FFC47A', emissiveIntensity: 0.2 });
const lampLights = [];
lampPos.forEach(([x, z], i) => {
  const tall = x > 40;
  box(0.14, tall ? 4.2 : 0.9, 0.14, '#2E3A42', x, tall ? 2.1 : 0.45, z, { cast: false });
  const b = new THREE.Mesh(new THREE.SphereGeometry(tall ? 0.28 : 0.2, 10, 8), bulbMat); b.position.set(x, tall ? 4.3 : 1.0, z); scene.add(b);
  if (i < 6) { const L = new THREE.PointLight('#FFC27A', 0, 22, 1.6); L.position.set(x, tall ? 4 : 1.2, z); scene.add(L); lampLights.push(L); }
});

/* ================= Tropical Sweet (marcador) ================= */
const DOOR = new THREE.Vector3(-23.2, 0, 22);
box(1.6, 2.4, 0.2, C.wood, -23.95, 1.2, 22, { cast: false }).rotation.y = Math.PI / 2;
const pin = new THREE.Group();
const pinHead = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), new THREE.MeshStandardMaterial({ color: '#E9A23B', emissive: '#E9A23B', emissiveIntensity: 0.45 }));
const pinTip = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.9, 16), pinHead.material); pinTip.rotation.x = Math.PI; pinTip.position.y = -0.62;
pin.add(pinHead, pinTip); pin.position.set(-21.6, 3.4, 22); scene.add(pin);
const ring = new THREE.Mesh(new THREE.RingGeometry(1.1, 1.4, 32), new THREE.MeshBasicMaterial({ color: '#E9A23B', transparent: true, opacity: 0.8 }));
ring.rotation.x = -Math.PI / 2; ring.position.set(-21.6, 0.05, 22); scene.add(ring);

/* ================= Pontos de interesse ================= */
const POI = [
  { n: 'Entrada Tropical', s: 'o portão do condomínio', p: [35, 6.6, 6] },
  { n: 'Piscina', s: 'a piscina principal', p: [-1, 1.6, 0] },
  { n: 'Bar da piscina', s: 'bebidas e snacks', p: [16, 6.6, -22] },
  { n: 'Jardins', s: 'relva e palmeiras', p: [-17.5, 1.6, -6] },
  { n: 'Pérgolas', s: 'espreguiçadeiras à sombra', p: [0.5, 3.6, 25.6] },
  { n: 'Jacuzzi', s: '', p: [13, 1.4, 9] },
  { n: 'Tropical Sweet', s: 'o teu apartamento', p: [-21.6, 4.6, 22], star: true },
  { n: 'Praia de Santa Maria', s: 'a 3 min a pé ↓', p: [47, 2.2, 58] }
];
const labelsEl = document.getElementById('labels');
POI.forEach((o) => {
  const el = document.createElement('button'); el.type = 'button';
  el.className = 'label' + (o.star ? ' star' : ''); el.innerHTML = o.n + (o.s ? `<small>${o.s}</small>` : '');
  el.addEventListener('click', (e) => { e.stopPropagation(); goTo(o.p[0], o.p[2]); });
  labelsEl.appendChild(el); o.el = el; o.v = new THREE.Vector3(...o.p);
});

/* ================= Jogador / controlos ================= */
const player = { x: 50, z: 6, yaw: Math.PI / 2, pitch: 0.02, r: 0.4 };
let target = null, started = false, bob = 0, near = false;
const keys = {};
addEventListener('keydown', (e) => { keys[e.code] = true; if (near && started && (e.code === 'KeyE' || e.code === 'Enter')) location.href = '../visita/'; if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault(); });
addEventListener('keyup', (e) => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

const joy = { id: null, x: 0, y: 0, el: document.getElementById('joy') };
const knob = joy.el.querySelector('i');
let look = null;
/* computador: o rato controla a câmara como num jogo (pointer lock); Esc solta o cursor */
const locked = () => document.pointerLockElement === canvas;
const lockMsg = document.getElementById('lockmsg');
lockMsg.addEventListener('click', () => lock());
function lock() { if (!touch && started && canvas.requestPointerLock) { try { const r = canvas.requestPointerLock(); if (r && r.catch) r.catch(() => {}); } catch (e) {} } }
document.addEventListener('pointerlockchange', () => {
  lockMsg.classList.toggle('on', started && !touch && !locked());
  document.body.classList.toggle('locked', locked());
  if (!locked()) keys.Mouse = false;
});
document.addEventListener('mousemove', (e) => {
  if (!locked()) return;
  const mx = Math.max(-120, Math.min(120, e.movementX)), my = Math.max(-120, Math.min(120, e.movementY));
  player.yaw -= mx * 0.0024;
  player.pitch = Math.max(-0.75, Math.min(0.6, player.pitch + my * 0.0024));
});
canvas.addEventListener('mousedown', (e) => { if (locked() && e.button === 0) keys.Mouse = true; });
addEventListener('mouseup', (e) => { if (e.button === 0) keys.Mouse = false; });
canvas.addEventListener('pointerdown', (e) => {
  canvas.focus();
  if (!touch) { if (!locked()) lock(); return; }
  look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!look || look.id !== e.pointerId) return;
  const dx = e.clientX - look.x, dy = e.clientY - look.y; look.x = e.clientX; look.y = e.clientY;
  player.yaw += dx * (touch ? 0.006 : 0.0042);
  player.pitch = Math.max(-0.75, Math.min(0.6, player.pitch - dy * (touch ? 0.004 : 0.003)));
});
canvas.addEventListener('pointerup', (e) => {
  if (!look || look.id !== e.pointerId) return;
  const moved = Math.hypot(e.clientX - look.sx, e.clientY - look.sy), dt = performance.now() - look.t;
  if (moved < 7 && dt < 350) clickGround(e.clientX, e.clientY);
  look = null;
});
function joyMove(e) {
  const r = joy.el.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2, R = r.width / 2;
  let dx = e.clientX - cx, dy = e.clientY - cy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; }
  joy.x = dx / R; joy.y = dy / R; knob.style.transform = `translate(${dx}px,${dy}px)`;
}
joy.el.addEventListener('pointerdown', (e) => { e.stopPropagation(); joy.id = e.pointerId; joy.el.setPointerCapture(e.pointerId); joyMove(e); target = null; });
joy.el.addEventListener('pointermove', (e) => { if (e.pointerId === joy.id) joyMove(e); });
const joyEnd = (e) => { if (e.pointerId !== joy.id) return; joy.id = null; joy.x = joy.y = 0; knob.style.transform = ''; };
joy.el.addEventListener('pointerup', joyEnd); joy.el.addEventListener('pointercancel', joyEnd);

const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function clickGround(cx, cy) {
  ndc.set(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(groundClick, false)[0];
  if (hit && hit.distance < 90) goTo(hit.point.x, hit.point.z);
}
function goTo(x, z) { target = { x, z }; }

function blocked(x, z) {
  const r = player.r;
  if (inPool(x, z, 0.6)) return true;
  for (const b of boxes) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true;
  for (const c of circles) if (Math.hypot(x - c.x, z - c.z) < c.r + r) return true;
  return x < -23.6 || x > 58 || z < -43.6 || z > 70;
}
function step(dx, dz) {
  // tenta mover; se bater, desliza ao longo do eixo livre
  if (!blocked(player.x + dx, player.z + dz)) { player.x += dx; player.z += dz; return true; }
  let ok = false;
  if (!blocked(player.x + dx, player.z)) { player.x += dx; ok = true; }
  else if (!blocked(player.x, player.z + dz)) { player.z += dz; ok = true; }
  return ok;
}

/* ================= Dia / noite ================= */
let night = false;
const dn = document.getElementById('daynight');
function setNight(on) {
  night = on; dn.textContent = on ? 'Ver de dia' : 'Ver à noite';
  skyMat.uniforms.top.value.set(on ? '#0B1D33' : '#6FC2E0');
  skyMat.uniforms.bottom.value.set(on ? '#27405A' : '#F4E3C8');
  scene.fog.color.set(on ? '#1A2E44' : '#CFE8EE');
  hemi.intensity = on ? 0.32 : 0.85; hemi.color.set(on ? '#6E8FBF' : '#DFF3FF');
  sun.intensity = on ? 0.35 : 2.4; sun.color.set(on ? '#9DB7FF' : '#FFE8C8');
  sun.position.set(on ? -30 : 40, 60, on ? -20 : 25);
  waterMat.emissiveIntensity = on ? 0.75 : 0.12; waterMat.emissive.set(on ? '#0C9FC4' : '#0FB5D0');
  winLitMat.emissiveIntensity = on ? 1.2 : 0;
  bulbMat.emissiveIntensity = on ? 2.2 : 0.2;
  lampLights.forEach((L) => (L.intensity = on ? 7 : 0));
  renderer.toneMappingExposure = on ? 1.25 : 1.05;
}
dn.addEventListener('click', () => setNight(!night));

/* ================= Minimapa ================= */
const mapC = document.getElementById('map'), mc = mapC.getContext('2d');
const MX = (x) => (x + 38) / 100 * mapC.width, MZ = (z) => (z + 58) / 128 * mapC.height;
function drawMap() {
  const w = mapC.width, h = mapC.height; mc.clearRect(0, 0, w, h);
  mc.fillStyle = 'rgba(233,215,189,.9)'; mc.fillRect(MX(-24), MZ(-44), MX(35) - MX(-24), MZ(44) - MZ(-44));
  mc.fillStyle = '#6E6A66'; mc.fillRect(MX(42.5), 0, MX(51.5) - MX(42.5), h);
  mc.fillStyle = '#C4673F';
  [[-35, -24, -55, 55], [-24, 10, -55, -44], [-24, 35, 44, 55]].forEach(([a, b, c, d]) => mc.fillRect(MX(a), MZ(c), MX(b) - MX(a), MZ(d) - MZ(c)));
  mc.fillStyle = '#B9B4AC'; mc.fillRect(MX(10), MZ(-55), MX(35) - MX(10), MZ(-40) - MZ(-55));
  mc.fillStyle = '#EDC6AC'; mc.fillRect(MX(35), MZ(-4), MX(39) - MX(35), MZ(16) - MZ(-4));
  mc.fillStyle = '#6FA65A'; mc.fillRect(MX(-23), MZ(-29), MX(-12) - MX(-23), MZ(17) - MZ(-29));
  mc.fillStyle = '#35BFD6'; mc.beginPath(); poolPoly.forEach((p, i) => (i ? mc.lineTo(MX(p.x), MZ(p.y)) : mc.moveTo(MX(p.x), MZ(p.y)))); mc.fill();
  mc.fillStyle = '#6E906A'; mc.beginPath(); mc.arc(MX(16), MZ(-22), 4.5 / 100 * w, 0, 7); mc.fill();
  mc.fillStyle = '#E9A23B'; mc.beginPath(); mc.arc(MX(-21.6), MZ(22), 7, 0, 7); mc.fill();
  // jogador
  const px = MX(player.x), pz = MZ(player.z);
  mc.save(); mc.translate(px, pz); mc.rotate(-player.yaw);
  mc.fillStyle = 'rgba(247,245,240,.25)'; mc.beginPath(); mc.moveTo(0, 0); mc.arc(0, 0, 34, -Math.PI / 2 - 0.55, -Math.PI / 2 + 0.55); mc.fill();
  mc.fillStyle = '#F7F5F0'; mc.beginPath(); mc.moveTo(0, -10); mc.lineTo(7, 7); mc.lineTo(0, 3); mc.lineTo(-7, 7); mc.closePath(); mc.fill();
  mc.restore();
}

/* ================= Loop ================= */
const doorEl = document.getElementById('door'), hintEl = document.getElementById('hint');
let last = performance.now(), hintTimer = 0;
const fwd = new THREE.Vector3();
function resize() {
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight; camera.fov = camera.aspect < 0.8 ? 78 : 68; camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (started) {
    let f = 0, s = 0;
    if (keys.KeyW || keys.ArrowUp || keys.Mouse) f += 1; if (keys.KeyS || keys.ArrowDown) f -= 1;
    if (keys.KeyA) s -= 1; if (keys.KeyD) s += 1;
    if (keys.ArrowLeft) player.yaw += 1.9 * dt; if (keys.ArrowRight) player.yaw -= 1.9 * dt;
    if (joy.id !== null) { f += -joy.y; s += joy.x; }
    const run = keys.ShiftLeft || keys.ShiftRight || Math.hypot(joy.x, joy.y) > 0.92;
    const speed = run ? 8 : 4.2;
    let moving = false;
    if (Math.abs(f) > 0.05 || Math.abs(s) > 0.05) {
      target = null;
      const len = Math.max(1, Math.hypot(f, s));
      const sy = Math.sin(player.yaw), cy = Math.cos(player.yaw);
      const dx = (-sy * f + cy * s) / len * speed * dt, dz = (-cy * f - sy * s) / len * speed * dt;
      moving = step(dx, dz);
    } else if (target) {
      const dx = target.x - player.x, dz = target.z - player.z, d = Math.hypot(dx, dz);
      if (d < 0.8) target = null;
      else {
        const want = Math.atan2(-dx, -dz);
        let diff = want - player.yaw; diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        player.yaw += diff * Math.min(1, dt * 4);
        const sp = Math.min(speed, d * 2) * dt;
        moving = step(dx / d * sp, dz / d * sp);
        if (!moving) target = null;
      }
    }
    if (moving) { bob += dt * (run ? 11 : 8); hintTimer += dt; }
    if (hintTimer > 4) hintEl.style.opacity = 0;
  } else {
    player.yaw += Math.sin(now / 4000) * 0.0006;
  }
  camera.position.set(player.x, 1.68 + Math.sin(bob) * 0.045, player.z);
  camera.rotation.set(-player.pitch, player.yaw, 0);

  // animações
  const t = now / 1000;
  pin.position.y = 3.4 + Math.sin(t * 2.2) * 0.25; pin.rotation.y = t;
  ring.scale.setScalar(1 + (t % 1.6) / 1.6 * 0.6); ring.material.opacity = 0.8 * (1 - (t % 1.6) / 1.6);
  waterMat.color.setHSL(0.52, night ? 0.85 : 0.62, (night ? 0.38 : 0.53) + Math.sin(t * 1.3) * 0.015);

  // porta do Tropical Sweet
  near = Math.hypot(player.x - DOOR.x, player.z - DOOR.z) < 5;
  doorEl.classList.toggle('on', near && started);

  // etiquetas
  camera.getWorldDirection(fwd);
  POI.forEach((o) => {
    const v = o.v.clone(), dist = camera.position.distanceTo(v);
    const toP = v.clone().sub(camera.position).normalize();
    v.project(camera);
    const vis = started && toP.dot(fwd) > 0.2 && dist < (o.star ? 140 : 38) && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
    o.el.style.opacity = vis ? Math.min(1, (o.star ? 140 : 38) / dist * 0.4) : 0;
    o.el.style.pointerEvents = vis ? 'auto' : 'none';
    if (vis) o.el.style.transform = `translate(${(v.x + 1) / 2 * innerWidth}px,${(1 - v.y) / 2 * innerHeight}px) translate(-50%,-100%)`;
  });

  drawMap();
  renderer.render(scene, camera);
  window.__tour = { player, setNight };
requestAnimationFrame(frame);
}

/* ================= Início ================= */
document.getElementById('load').textContent = '';
document.getElementById('start').addEventListener('click', () => {
  started = true; document.getElementById('intro').classList.add('off'); canvas.focus(); lock();
  if (!touch) setTimeout(() => lockMsg.classList.toggle('on', !locked()), 400);
});
requestAnimationFrame(frame);
