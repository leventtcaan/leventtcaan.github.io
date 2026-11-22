import "./style.css";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const root = document.documentElement;
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function hasWebGL() {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
}

// Adım vurgusu: akış ilerlemesine göre aktif adımı seç
const steps = [...document.querySelectorAll(".step")];
function setActiveStep(progress) {
  const idx = Math.min(steps.length - 1, Math.floor(progress * steps.length));
  steps.forEach((s, i) => s.classList.toggle("is-active", i === idx));
}
setActiveStep(0);

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
  if (reduceMotion || !hasWebGL()) return; // yedek telefon görseli ve düz sayfa kalır
  const { createScene } = await import("./scene.js");
  const labels = [...document.querySelectorAll(".flow-label")];
  const scene = createScene(document.getElementById("webgl"), { labels });
  root.classList.add("gl");

  // Hero -> akış geçişi: hero'nun alt yarısından akış bölümünün başına kadar
  ScrollTrigger.create({
    trigger: "#how",
    start: "top 90%",
    end: "top top",
    scrub: true,
    onUpdate: (st) => scene.setHero(st.progress),
  });

  // Akış sahnesi: sabit bölüm boyunca 0..1
  ScrollTrigger.create({
    trigger: "#how",
    start: "top top",
    end: "bottom bottom",
    scrub: true,
    onUpdate: (st) => {
      scene.setFlow(st.progress);
      setActiveStep(st.progress);
    },
  });

  // Akış bölümünden çıkınca sahne söner
  ScrollTrigger.create({
    trigger: "#work",
    start: "top 85%",
    end: "top 35%",
    scrub: true,
    onUpdate: (st) => scene.setExit(st.progress),
  });
}

boot();
