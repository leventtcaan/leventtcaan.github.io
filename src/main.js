import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const wide = window.matchMedia("(min-width: 861px)").matches;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// Adım vurgusu (karar akışı)
const steps = [...document.querySelectorAll(".step")];
function setActiveStep(progress) {
  const idx = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  steps.forEach((s, i) => s.classList.toggle("is-active", i === idx));
}
setActiveStep(0);

// Katman vurgusu (sistem haritası)
const layers = [...document.querySelectorAll(".layer")];
function setActiveLayer(idx) {
  layers.forEach((l, i) => l.classList.toggle("is-active", i === idx));
}

// Giriş animasyonları
if (reduceMotion) {
  root.classList.add("no-motion");
} else {
  ScrollTrigger.batch(".reveal", {
    start: "top 88%",
    onEnter: (els) => els.forEach((el) => el.classList.add("is-in")),
  });
}

async function boot() {
  // Mobilde, hareket azaltılmışsa ya da WebGL yoksa 3D yüklenmez: yedek telefon görseli ve düz sayfa kalır
  if (reduceMotion || !wide || !hasWebGL()) return;
  root.classList.add("gl"); // düzen hemen sabitlenen haline geçer, sahne arkadan yüklenir
  let scene;
  try {
    const { createScene } = await import("./scene.js");
    scene = createScene(document.getElementById("webgl"), {
      flowLabels: [...document.querySelectorAll(".flow-label")],
      stackLabels: [...document.querySelectorAll(".stack-label")],
    });
  } catch (err) {
    root.classList.remove("gl");
    console.warn("3D scene unavailable", err);
    return;
  }

  const scrub = (trigger, start, end, fn) =>
    ScrollTrigger.create({ trigger, start, end, scrub: true, onUpdate: (st) => fn(st.progress) });

  // Hero -> katman haritası: kule açılır
  scrub("#stack", "top 90%", "top top", scene.setHero);
  // Harita sabitken: aktif katman
  let hovering = false;
  let stackP = 0;
  const scrollLayer = () => Math.min(layers.length - 1, Math.floor(stackP * layers.length));
  scrub("#stack", "top top", "bottom bottom", (p) => {
    stackP = p;
    scene.setStack(p);
    if (!hovering) setActiveLayer(scrollLayer());
  });
  // Haritadan çıkınca kule söner
  scrub("#work", "top bottom", "top 50%", scene.setStackExit);
  // Karar akışı
  scrub("#how", "top 90%", "top top", scene.setFlowIn);
  scrub("#how", "top top", "bottom bottom", (p) => {
    scene.setFlow(p);
    setActiveStep(p);
  });
  scrub("#principles", "top 85%", "top 35%", scene.setFlowExit);

  // Satırın üstüne gelince ilgili plaka yanar
  layers.forEach((l, i) => {
    const on = () => { hovering = true; scene.setHover(i); setActiveLayer(i); };
    const off = () => { hovering = false; scene.setHover(-1); setActiveLayer(scrollLayer()); };
    l.addEventListener("mouseenter", on);
    l.addEventListener("mouseleave", off);
    l.addEventListener("focusin", on);
    l.addEventListener("focusout", off);
  });
}

boot();
