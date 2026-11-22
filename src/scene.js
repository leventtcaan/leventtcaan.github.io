import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

const ACCENT = new THREE.Color("#4c8dff");
const WHITE = new THREE.Color("#f2f4f8");

// Sahne durumu dışarıdan (kaydırma) ayarlanır: hero 0..1 ve akış 0..1
export function createScene(canvas, { labels }) {
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

  const state = { hero: 0, flow: 0, exit: 0, pointerX: 0, pointerY: 0, mobile: false };

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
  const nodeGeo = new THREE.BufferGeometry().setFromPoints(nodes);
  network.add(new THREE.Points(nodeGeo, new THREE.PointsMaterial({ color: ACCENT, size: 0.07, transparent: true, opacity: 0.55, depthWrite: false })));
  const linePts = [];
  for (let i = 0; i < NODE_COUNT; i++) {
    for (let j = i + 1; j < NODE_COUNT; j++) {
      if (nodes[i].distanceTo(nodes[j]) < 2.6) linePts.push(nodes[i], nodes[j]);
    }
  }
  const netLines = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(linePts),
    new THREE.LineBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, depthWrite: false })
  );
  network.add(netLines);

  // ---------- Telefon ----------
  const phone = new THREE.Group();
  scene.add(phone);
  const body = new THREE.Mesh(
    new RoundedBoxGeometry(2.05, 4.45, 0.2, 8, 0.3),
    new THREE.MeshStandardMaterial({ color: 0x1a1e26, metalness: 0.75, roughness: 0.32 })
  );
  phone.add(body);

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
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(screenW, screenH),
    new THREE.MeshBasicMaterial({ map: screenTex, alphaMap: new THREE.CanvasTexture(mask), transparent: true })
  );
  screen.position.z = 0.101;
  phone.add(screen);

  // ---------- Karar akışı ----------
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

  // Parçacıklar: girdi -> motor (ve adım 3'ten sonra motor -> karar)
  const P = 180;
  const pPos = new Float32Array(P * 3);
  const particles = Array.from({ length: P }, (_, i) => ({
    lane: i % 4,
    t: Math.random(),
    speed: 0.18 + Math.random() * 0.22,
    wobble: (Math.random() - 0.5) * 0.5,
    outbound: i % 6 === 0, // bir kısmı karara gider
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
  const layout = { heroPhoneX: 3.2, flowX: 1.7, scale: 1, flowScale: 0.8 };
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    state.mobile = w < 860;
    const visH = 2 * camera.position.z * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const visW = visH * camera.aspect;
    layout.heroPhoneX = visW * 0.24;
    layout.flowX = visW * 0.12;
    layout.scale = Math.min(1, visW / 14);
    layout.flowScale = Math.min(0.82, visW / 17);
  }
  resize();
  window.addEventListener("resize", resize);
  window.addEventListener("pointermove", (e) => {
    state.pointerX = e.clientX / window.innerWidth - 0.5;
    state.pointerY = e.clientY / window.innerHeight - 0.5;
  });

  // ---------- Etiketleri 3D noktalara iliştir ----------
  const tmp = new THREE.Vector3();
  const anchors = {
    "in-0": inputs[0], "in-1": inputs[1], "in-2": inputs[2], "in-3": inputs[3],
    engine: new THREE.Vector3(0, -1.15, 0),
    decision: new THREE.Vector3(2.4, 1.25, 0),
    ai: new THREE.Vector3(2.4, -1.35, 0),
  };
  const labelOffsets = { "in-0": [-58, 0], "in-1": [-46, 0], "in-2": [-56, 0], "in-3": [-48, 0], ai: [0, 40] };
  function placeLabels(vis) {
    for (const el of labels) {
      const key = el.dataset.label;
      tmp.copy(anchors[key]);
      flow.localToWorld(tmp);
      tmp.project(camera);
      const [ox, oy] = labelOffsets[key] || [0, 0];
      const x = (tmp.x * 0.5 + 0.5) * window.innerWidth + ox;
      const y = (-tmp.y * 0.5 + 0.5) * window.innerHeight + oy;
      const half = (el.offsetWidth || 0) / 2 + 16;
      const cx = Math.min(Math.max(x, half), window.innerWidth - half);
      el.style.transform = `translate(${cx}px, ${y}px) translate(-50%, -50%)`;
      el.style.opacity = vis[key] ?? 0;
    }
  }

  // ---------- Döngü ----------
  const clock = new THREE.Clock();
  const smooth = { hero: 0, flow: 0, exit: 0, px: 0, py: 0 };
  let running = true;

  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    smooth.hero += (state.hero - smooth.hero) * 0.12;
    smooth.flow += (state.flow - smooth.flow) * 0.12;
    smooth.px += (state.pointerX - smooth.px) * 0.06;
    smooth.py += (state.pointerY - smooth.py) * 0.06;
    const H = smooth.hero; // 0: hero, 1: akış sahnesinde
    const F = smooth.flow; // akış ilerlemesi 0..1

    network.rotation.y = time * 0.015 + smooth.px * 0.15;
    network.rotation.x = smooth.py * 0.08;

    // Telefon: hero'da sağda, akışa geçince sağa kayıp küçülür ve söner
    phone.visible = !state.mobile && H < 0.9;
    phone.position.set(layout.heroPhoneX + H * H * 7, -H * 0.8 + Math.sin(time * 0.8) * 0.06, -H * 2);
    phone.rotation.y = -0.38 + smooth.px * 0.35 + H * 0.5;
    phone.rotation.x = 0.06 + smooth.py * -0.2;
    phone.scale.setScalar(layout.scale * (1 - H * 0.25));

    // Akış grubu
    smooth.exit += (state.exit - smooth.exit) * 0.12;
    const fv = state.mobile ? 0 : THREE.MathUtils.smoothstep(H, 0.35, 0.85) * (1 - smooth.exit);
    flow.visible = fv > 0.01;
    flow.position.x = layout.flowX;
    flow.scale.setScalar(layout.flowScale);
    const s1 = THREE.MathUtils.smoothstep(F, 0.22, 0.32); // motor
    const s2 = THREE.MathUtils.smoothstep(F, 0.47, 0.57); // karar
    const s3 = THREE.MathUtils.smoothstep(F, 0.72, 0.82); // AI açıklaması

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

    for (let i = 0; i < P; i++) {
      const p = particles[i];
      p.t += dt * p.speed * (0.6 + s1);
      if (p.t > 1) p.t -= 1;
      const goesOut = p.outbound && s2 > 0.5;
      if (goesOut) curve(enginePos, decisionPos, 0.4 + p.wobble * 0.3, p.t, tmp);
      else curve(inputs[p.lane], enginePos, p.wobble, p.t, tmp);
      pPos[i * 3] = tmp.x; pPos[i * 3 + 1] = tmp.y; pPos[i * 3 + 2] = tmp.z;
    }
    pGeo.attributes.position.needsUpdate = true;

    if (labels.length) {
      placeLabels({
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

  return {
    setHero(v) { state.hero = v; },
    setFlow(v) { state.flow = v; },
    setExit(v) { state.exit = v; },
  };
}
