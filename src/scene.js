import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const ACCENT = new THREE.Color("#4c8dff");
const WHITE = new THREE.Color("#f2f4f8");
const PLATE_COUNT = 6; // Mobile, Web, API, AI, Data, Infra (Tests = kafes)

// Sahne durumu dışarıdan (kaydırma) ayarlanır.
// hero: 0 hero, 1 katman haritası · stack: harita ilerlemesi · stackExit · flowIn · flow · flowExit
export function createScene(canvas, { flowLabels, stackLabels }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-4, 6, 8);
  scene.add(key);
  const rim = new THREE.PointLight(ACCENT, 18, 20);
  rim.position.set(4, 2, 2);
  scene.add(rim);

  const state = {
    hero: 0, stack: 0, stackExit: 0, flowIn: 0, flow: 0, flowExit: 0,
    hover: -1, pointerX: 0, pointerY: 0, mobile: false,
  };

  // ---------- Arka plan: yavaş dönen düğüm ağı ----------
  const network = new THREE.Group();
  scene.add(network);
  const NODE_COUNT = 220;
  const nodes = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    const r = 9 + Math.random() * 9;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    nodes.push(new THREE.Vector3(r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta) * 0.6, r * Math.cos(phi) - 8));
  }
  network.add(new THREE.Points(new THREE.BufferGeometry().setFromPoints(nodes), new THREE.PointsMaterial({ color: ACCENT, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false })));
  const linePts = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      if (nodes[i].distanceTo(nodes[j]) < 2.6) linePts.push(nodes[i], nodes[j]);
    }
  }
  network.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, depthWrite: false })
  ));

  // ---------- Katman kulesi (sistem haritası) ----------
  const tower = new THREE.Group();
  scene.add(tower);
  const PW = 2.7, PH = 0.1, PD = 1.7;
  const plateGeo = new RoundedBoxGeometry(PW, PH, PD, 3, 0.04);
  const plateEdgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(PW, PH, PD));
  // Üst yüzde ince ızgara
  const gridPts = [];
  const gy = PH / 2 + 0.003;
  for (let x = -PW / 2 + 0.25; x < PW / 2 - 0.1; x += 0.25) gridPts.push(new THREE.Vector3(x, gy, -PD / 2 + 0.08), new THREE.Vector3(x, gy, PD / 2 - 0.08));
  for (let z = -PD / 2 + 0.25; z < PD / 2 - 0.1; z += 0.25) gridPts.push(new THREE.Vector3(-PW / 2 + 0.08, gy, z), new THREE.Vector3(PW / 2 - 0.08, gy, z));
  const gridGeo = new THREE.BufferGeometry().setFromPoints(gridPts);

  const plates = Array.from({ length: PLATE_COUNT }, () => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(plateGeo, new THREE.MeshStandardMaterial({
      color: 0x131824, metalness: 0.45, roughness: 0.45, emissive: ACCENT, emissiveIntensity: 0.05, transparent: true, opacity: 0.9,
    }));
    const edges = new THREE.LineSegments(plateEdgeGeo, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.5 }));
    const grid = new THREE.LineSegments(gridGeo, new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.08, depthWrite: false }));
    g.add(body, edges, grid);
    tower.add(g);
    return { g, body, edges, grid, glow: 0 };
  });

  // Tests: kulenin etrafında kesikli kafes
  const cageBase = 1;
  const cageGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(PW + 0.36, cageBase, PD + 0.36));
  const cage = new THREE.LineSegments(cageGeo, new THREE.LineDashedMaterial({ color: WHITE, dashSize: 0.07, gapSize: 0.07, transparent: true, opacity: 0.2 }));
  cage.computeLineDistances();
  tower.add(cage);

  // Paketler: katmanlar arasında aşağı inip geri çıkan istekler
  const K = 90;
  const kPos = new Float32Array(K * 3);
  const packets = Array.from({ length: K }, () => ({
    x: (Math.random() - 0.5) * (PW - 0.5),
    z: (Math.random() - 0.5) * (PD - 0.4),
    t: Math.random(),
    speed: 0.12 + Math.random() * 0.12,
  }));
  const kGeo = new THREE.BufferGeometry();
  kGeo.setAttribute("position", new THREE.BufferAttribute(kPos, 3));
  const kMat = new THREE.PointsMaterial({ color: ACCENT, size: 0.06, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  tower.add(new THREE.Points(kGeo, kMat));

  // ---------- Telefon: kulenin en üstündeki istemci ----------
  const phone = new THREE.Group();
  scene.add(phone);
  const phoneBody = new THREE.Mesh(
    new RoundedBoxGeometry(2.05, 4.45, 0.2, 8, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1e26, metalness: 0.75, roughness: 0.32, transparent: true, opacity: 1 })
  );
  phone.add(phoneBody);
  const screenW = 1.9, screenH = 4.13;
  const mask = document.createElement("canvas");
  mask.width = 256; mask.height = Math.round(256 * screenH / screenW);
  const mctx = mask.getContext("2d");
  mctx.fillStyle = "#000"; mctx.fillRect(0, 0, mask.width, mask.height);
  mctx.fillStyle = "#fff";
  mctx.beginPath(); mctx.roundRect(0, 0, mask.width, mask.height, 30); mctx.fill();
  const screenTex = new THREE.TextureLoader().load("/img/nc-02-the-call.webp");
  screenTex.colorSpace = THREE.SRGBColorSpace;
  screenTex.anisotropy = 4;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, alphaMap: new THREE.CanvasTexture(mask), transparent: true });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(screenW, screenH), screenMat);
  screen.position.z = 0.101;
  phone.add(screen);

  // ---------- Karar akışı (Next Call'a yakından bakış) ----------
  const flow = new THREE.Group();
  scene.add(flow);
  const inputs = [1.6, 0.55, -0.5, -1.55].map((y) => new THREE.Vector3(-3.3, y, 0));
  const enginePos = new THREE.Vector3(0, 0, 0);
  const decisionPos = new THREE.Vector3(2.4, 0.35, 0);
  const inputDots = inputs.map((p) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), new THREE.MeshBasicMaterial({ color: WHITE, transparent: true, opacity: 0 }));
    m.position.copy(p);
    flow.add(m);
    return m;
  });
  const engine = new THREE.Group();
  engine.position.copy(enginePos);
  flow.add(engine);
  const engineBox = new THREE.BoxGeometry(1.35, 1.35, 1.35);
  const engineEdges = new THREE.LineSegments(new THREE.EdgesGeometry(engineBox), new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0 }));
  const engineCore = new THREE.Mesh(engineBox, new THREE.MeshStandardMaterial({ color: ACCENT, emissive: ACCENT, emissiveIntensity: 0.25, transparent: true, opacity: 0, roughness: 0.4 }));
  engineCore.scale.setScalar(0.55);
  engine.add(engineEdges, engineCore);
  const decision = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.42),
    new THREE.MeshStandardMaterial({ color: WHITE, emissive: ACCENT, emissiveIntensity: 0.5, metalness: 0.2, roughness: 0.25, transparent: true, opacity: 0 })
  );
  decision.position.copy(decisionPos);
  flow.add(decision);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.6, 0.63, 64), new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, side: THREE.DoubleSide }));
  ring.position.copy(decisionPos);
  flow.add(ring);
  const P = 180;
  const pPos = new Float32Array(P * 3);
  const particles = Array.from({ length: P }, (_, i) => ({
    lane: i % 4, t: Math.random(), speed: 0.18 + Math.random() * 0.22,
    wobble: (Math.random() - 0.5) * 0.5, outbound: i % 6 === 0,
  }));
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: ACCENT, size: 0.07, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  flow.add(new THREE.Points(pGeo, pMat));
  const curve = (a, b, bend, t, out) => {
    const mid = new THREE.Vector3((a.x + b.x) / 2, (a.y + b.y) / 2 + bend, 0);
    const u = 1 - t;
    out.set(u * u * a.x + 2 * u * t * mid.x + t * t * b.x, u * u * a.y + 2 * u * t * mid.y + t * t * b.y, 0);
    return out;
  };

  // ---------- Boyut ve konum ----------
  const layout = { towerX: 2.8, towerY: -0.6, scale: 1, flowX: 1.7, flowScale: 0.8 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    state.mobile = w < 860;
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    // Kule sağ sütunda; içerik genişliği 1180px ile sınırlı, bu yüzden geniş ekranda merkeze yaklaşır
    const contentHalf = Math.min(w, 1180) / 2;
    const colCenterPx = w / 2 + contentHalf * 0.5;
    layout.towerX = (colCenterPx / w - 0.5) * visW;
    layout.scale = Math.min(1, visW / 13, visH / 7.2);
    layout.flowX = visW * 0.15;
    layout.flowScale = Math.min(0.82, visW / 17);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    state.pointerX = e.clientX / window.innerWidth - 0.5;
    state.pointerY = e.clientY / window.innerHeight - 0.5;
  });

  // ---------- Etiketler ----------
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  function toScreen(v) {
    v.project(camera);
    return [(v.x * 0.5 + 0.5) * window.innerWidth, (-v.y * 0.5 + 0.5) * window.innerHeight];
  }
  function setLabel(el, x, y, opacity, alignLeft) {
    const wEl = el.offsetWidth || 0;
    let cx = alignLeft ? x : x - wEl / 2;
    cx = Math.min(Math.max(cx, 12), window.innerWidth - wEl - 12);
    el.style.transform = `translate(${cx}px, ${y}px) translateY(-50%)`;
    el.style.opacity = opacity;
  }

  const flowAnchors = {
    "in-0": inputs[0], "in-1": inputs[1], "in-2": inputs[2], "in-3": inputs[3],
    engine: new THREE.Vector3(0, -1.15, 0),
    decision: new THREE.Vector3(2.4, 1.25, 0),
    ai: new THREE.Vector3(2.4, -1.35, 0),
  };
  const flowOffsets = { "in-0": [-58, 0], "in-1": [-46, 0], "in-2": [-56, 0], "in-3": [-48, 0], ai: [0, 40] };
  function placeFlowLabels(vis) {
    for (const el of flowLabels) {
      const k = el.dataset.label;
      tmp.copy(flowAnchors[k]);
      flow.localToWorld(tmp);
      const [x, y] = toScreen(tmp);
      const [ox, oy] = flowOffsets[k] || [0, 0];
      setLabel(el, x + ox, y + oy, vis[k] ?? 0, false);
    }
  }

  function placeStackLabels(vis, active) {
    for (const el of stackLabels) {
      const i = Number(el.dataset.slabel);
      let x, y;
      if (i < PLATE_COUNT) {
        // Plakanın sağ kenarındaki iki köşeden ekranda daha sağda olanı
        const g = plates[i].g;
        // Kafesin dışında kalsın diye kafes köşesine iliştir
        const ox = PW / 2 + 0.18, oz = PD / 2 + 0.18;
        tmp.set(ox, 0, oz); g.localToWorld(tmp);
        tmp2.set(ox, 0, -oz); g.localToWorld(tmp2);
        const a = toScreen(tmp), b = toScreen(tmp2);
        x = Math.max(a[0], b[0]) + 16; y = (a[1] + b[1]) / 2;
      } else {
        tmp.set(0, -cageBase / 2, PD / 2 + 0.18); cage.localToWorld(tmp);
        const p = toScreen(tmp);
        x = p[0]; y = p[1] + 46;
      }
      setLabel(el, x, y, vis, i < PLATE_COUNT);
      el.classList.toggle("is-active", i === active);
    }
  }

  // ---------- Döngü ----------
  const clock = new THREE.Clock();
  const smooth = { hero: 0, stack: 0, stackExit: 0, flowIn: 0, flow: 0, flowExit: 0, px: 0, py: 0 };
  const ease = (k, f = 0.12) => { smooth[k] += (state[k] - smooth[k]) * f; return smooth[k]; };
  let running = true;

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    const H = ease("hero"), S = ease("stack"), SX = ease("stackExit");
    const FI = ease("flowIn"), F = ease("flow"), FX = ease("flowExit");
    smooth.px += (state.pointerX - smooth.px) * 0.06;
    smooth.py += (state.pointerY - smooth.py) * 0.06;

    network.rotation.y = time * 0.015 + smooth.px * 0.15;
    network.rotation.x = smooth.py * 0.08;

    // ----- Kule -----
    const tv = state.mobile ? 0 : 1 - THREE.MathUtils.smoothstep(SX, 0.05, 0.9);
    tower.visible = tv > 0.01;
    const gap = THREE.MathUtils.lerp(0.4, 0.66, THREE.MathUtils.smoothstep(H, 0, 1));
    const stackH = gap * (PLATE_COUNT - 1);
    const sc = layout.scale * THREE.MathUtils.lerp(0.8, 0.76, H);
    tower.scale.setScalar(sc);
    tower.position.set(layout.towerX, THREE.MathUtils.lerp(-0.7, -0.85, H) + Math.sin(time * 0.7) * 0.04, 0);
    tower.rotation.set(0.42 + smooth.py * -0.08, -0.62 + smooth.px * 0.22, 0);

    // Aktif katman: harita sabitken kaydırma, imleç üstündeyse imleç
    const inMap = H > 0.85 && SX < 0.3;
    const scrollActive = Math.min(6, Math.floor(S * 7));
    const active = state.hover >= 0 ? state.hover : inMap ? scrollActive : -1;

    plates.forEach((p, i) => {
      const baseY = stackH / 2 - i * gap;
      // Hero'da yukarıdan aşağı inen yavaş bir dalga (istek katmanlardan geçiyor)
      const wave = Math.max(0, Math.sin(time * 1.1 - i * 0.7)) * (1 - H) * 0.6;
      const target = active === i ? 1 : active === 6 ? 0.35 : wave * 0.5;
      p.glow += (target - p.glow) * 0.1;
      p.g.position.set(0, baseY + p.glow * 0.08, p.glow * 0.12);
      p.body.material.opacity = tv * 0.9;
      p.body.material.emissiveIntensity = 0.05 + p.glow * 0.45;
      p.edges.material.opacity = tv * (active >= 0 && active !== i && active !== 6 ? 0.28 : 0.5 + p.glow * 0.5);
      p.grid.material.opacity = tv * (0.06 + p.glow * 0.22);
    });
    cage.scale.set(1, (stackH + 0.5) / cageBase, 1);
    cage.position.y = 0;
    cage.material.opacity = tv * (active === 6 ? 0.85 : 0.18 + (1 - H) * 0.05);
    cage.material.color.copy(active === 6 ? ACCENT : WHITE);

    kMat.opacity = tv * (0.5 + H * 0.4);
    for (let i = 0; i < K; i++) {
      const k = packets[i];
      k.t += dt * k.speed;
      if (k.t > 1) k.t -= 1;
      const tri = k.t < 0.5 ? k.t * 2 : 2 - k.t * 2; // aşağı in, geri çık
      kPos[i * 3] = k.x;
      kPos[i * 3 + 1] = stackH / 2 + 0.1 - tri * (stackH + 0.2);
      kPos[i * 3 + 2] = k.z;
    }
    kGeo.attributes.position.needsUpdate = true;

    // ----- Telefon: en üst plakanın üstünde, kameraya dönük -----
    tmp.set(0.35, PH / 2, 0.1);
    plates[0].g.localToWorld(tmp);
    const ps = sc * THREE.MathUtils.lerp(0.36, 0.3, H) * (1 + plates[0].glow * 0.06);
    phone.visible = tower.visible;
    phone.scale.setScalar(ps);
    phone.position.set(tmp.x, tmp.y + 2.225 * ps + 0.05, tmp.z + 0.2);
    phone.rotation.set(0.04 + smooth.py * -0.15, -0.38 + smooth.px * 0.3, 0);
    phoneBody.material.opacity = tv;
    screenMat.opacity = tv;

    if (stackLabels.length) placeStackLabels(tv * (0.55 + H * 0.45), active);

    // ----- Karar akışı -----
    const fv = state.mobile ? 0 : THREE.MathUtils.smoothstep(FI, 0.62, 1) * (1 - FX);
    flow.visible = fv > 0.01;
    flow.position.x = layout.flowX;
    flow.scale.setScalar(layout.flowScale);
    const s1 = THREE.MathUtils.smoothstep(F, 0.22, 0.32);
    const s2 = THREE.MathUtils.smoothstep(F, 0.47, 0.57);
    const s3 = THREE.MathUtils.smoothstep(F, 0.72, 0.82);
    inputDots.forEach((d) => { d.material.opacity = fv; });
    engineEdges.material.opacity = fv * (0.35 + s1 * 0.65);
    engineCore.material.opacity = fv * (0.08 + s1 * 0.35);
    engineCore.material.emissiveIntensity = 0.25 + s1 * (0.6 + Math.sin(time * 4) * 0.2);
    engine.rotation.x = time * 0.25;
    engine.rotation.y = time * 0.35;
    decision.material.opacity = fv * s2;
    decision.scale.setScalar(0.4 + s2 * 0.6);
    decision.rotation.y = time * 0.8;
    ring.material.opacity = fv * s3 * (0.5 + Math.sin(time * 3) * 0.3);
    ring.scale.setScalar(1 + ((time * 0.6) % 1) * s3 * 0.8);
    pMat.opacity = fv * 0.9;
    if (flow.visible) {
      for (let i = 0; i < P; i++) {
        const p = particles[i];
        p.t += dt * p.speed * (0.6 + s1);
        if (p.t > 1) p.t -= 1;
        if (p.outbound && s2 > 0.5) curve(enginePos, decisionPos, 0.4 + p.wobble * 0.3, p.t, tmp);
        else curve(inputs[p.lane], enginePos, p.wobble, p.t, tmp);
        pPos[i * 3] = tmp.x; pPos[i * 3 + 1] = tmp.y; pPos[i * 3 + 2] = tmp.z;
      }
      pGeo.attributes.position.needsUpdate = true;
    }
    if (flowLabels.length) {
      placeFlowLabels({
        "in-0": fv, "in-1": fv, "in-2": fv, "in-3": fv,
        engine: fv * s1, decision: fv * s2, ai: fv * s3,
      });
    }

    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  document.addEventListener("visibilitychange", () => {
    running = !document.hidden;
    if (running) { clock.getDelta(); requestAnimationFrame(frame); }
  });

  const setter = (k) => (v) => { state[k] = v; };
  return {
    setHero: setter("hero"),
    setStack: setter("stack"),
    setStackExit: setter("stackExit"),
    setFlowIn: setter("flowIn"),
    setFlow: setter("flow"),
    setFlowExit: setter("flowExit"),
    setHover: setter("hover"),
  };
}
