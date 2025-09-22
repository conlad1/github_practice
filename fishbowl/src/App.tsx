import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

type FishSpec = {
  id: number;
  depthPct: number;      // 18–82 (baseline cruising level)
  speedSec: number;      // 8–14
  scale: number;         // 3–4
  hue: number;           // -20–35
};

type Pellet = {
  id: number;
  xPct: number;          // 4–96 (% of bowl width)
  yPx: number;           // px from bowl top
  vy: number;            // px/s
  size: number;          // px
};

type Bubble = {
  id: number;
  xPct: number;
  yPx: number;           // px from bowl top
  vy: number;            // px/s (negative = up)
  size: number;          // px
  opacity: number;
};

const randomBetween = (min: number, max: number) => Math.random() * (max - min) + min;

const makeFish = (id: number): FishSpec => ({
  id,
  depthPct: Math.round(randomBetween(18, 82)),
  speedSec: Math.round(randomBetween(8, 14)),
  scale: Math.round(randomBetween(3, 4)),
  hue: Math.round(randomBetween(-20, 35)),
});

/** ---------- Pixel Fish SPRITE (higher-detail; Minecrafty) ---------- */
const PixelFishSprite: React.FC = () => {
  // 24 x 16 grid. '.' transparent
  // A (amber/orange), H (highlight), S (shadow), F (fin), E (eye)
  const rows = useMemo(
    () => [
      ".............FF........",
      "..........FFFFF........",
      "........AAAAAAA........",
      ".......AAAAHAAAA.......",
      ".....AAAASAAAHAAAA.....",
      "....AAAASAAAAASAAAA....",
      "...AAAAASAAAAASAAAAA...",
      "...AAAAASAAAAASAAAAA...",
      "...AAAAASAAAAASAAAAA...",
      "....AAAASAAAAASAAAA....",
      ".....AAAAHAAAASAAA.....",
      ".......AAAAAAA.E.......",
      "........AAAAAAA........",
      "..........FFFFF........",
      "...........FFF.........",
      "............F..........",
    ],
    []
  );

  const palette: Record<string, string> = {
    A: "#F59E0B", // body
    H: "#FCD34D", // highlight
    S: "#D97706", // shadow
    F: "#F59E0B", // fins
    E: "#0B1020", // eye
  };

  const W = rows[0].length;
  const Hh = rows.length;

  return (
    <svg
      className="pixel-sprite"
      width={W}
      height={Hh}
      viewBox={`0 0 ${W} ${Hh}`}
      shapeRendering="crispEdges"
      aria-label="pixel fish"
    >
      {rows.map((row, y) =>
        row.split("").map((c, x) =>
          c === "."
            ? null
            : (
              <rect
                key={`${x}-${y}`}
                x={x}
                y={y}
                width={1}
                height={1}
                fill={palette[c] || "transparent"}
              />
            )
        )
      )}
      {/* dorsal outline + belly shadow for definition */}
      <rect x={6} y={2} width={6} height={1} fill="#c26b00" />
      <rect x={5} y={10} width={12} height={1} fill="#b66100" />
    </svg>
  );
};

const Fish: React.FC<{
  spec: FishSpec;
  depthPct: number; // dynamic vertical position (seeking)
  paused: boolean;
  globalSpeedMultiplier: number;
  registerRef: (id: number, el: HTMLDivElement | null) => void;
}> = ({ spec, depthPct, paused, globalSpeedMultiplier, registerRef }) => {
  const duration = spec.speedSec / Math.max(0.25, globalSpeedMultiplier);

  return (
    <div
      className={`fish ${paused ? "paused" : ""}`}
      ref={(el) => registerRef(spec.id, el)}
      style={{
        top: `${depthPct}%`,
        animationDuration: `${duration}s`,
        filter: `hue-rotate(${spec.hue}deg)`,
      }}
      title="Fish"
    >
      <div
        className="sprite-wrap"
        style={{
          transform: `translate(-50%, -50%) scale(${spec.scale})`,
        }}
      >
        <PixelFishSprite />
      </div>
    </div>
  );
};

let pelletId = 0;
let bubbleId = 0;

const App: React.FC = () => {
  // UI / toggles
  const [fish, setFish] = useState<FishSpec[]>([makeFish(0), makeFish(1)]);
  const [paused, setPaused] = useState(false);
  const [scanlines, setScanlines] = useState(true);
  const [night, setNight] = useState(false);
  const [speed, setSpeed] = useState(1);

  // Physics layers
  const [pellets, setPellets] = useState<Pellet[]>([]);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);

  // Per-fish dynamic vertical positions (for seeking behavior)
  const [fishDepths, setFishDepths] = useState<Map<number, number>>(new Map());

  const bowlRef = useRef<HTMLDivElement>(null);
  const fishRefs = useRef(new Map<number, HTMLDivElement | null>()).current;

  // Ensure new fish get an initial depth entry
  useEffect(() => {
    setFishDepths((prev) => {
      const next = new Map(prev);
      fish.forEach((f) => {
        if (!next.has(f.id)) next.set(f.id, f.depthPct);
      });
      // drop removed fish if any
      Array.from(next.keys()).forEach((id) => {
        if (!fish.find((f) => f.id === id)) next.delete(id);
      });
      return next;
    });
  }, [fish]);

  const registerFishRef = (id: number, el: HTMLDivElement | null) => {
    fishRefs.set(id, el);
  };

  const addFish = () => setFish((f) => [...f, makeFish(f.length)]);

  const feed = (count = 5) => {
    const startY = -8; // just above water top
    const newPellets: Pellet[] = Array.from({ length: count }).map(() => ({
      id: ++pelletId,
      xPct: randomBetween(4, 96),
      yPx: startY,
      // ↓ slightly decreased drop speed
      vy: randomBetween(120, 160), // px/s
      size: 6,
    }));
    setPellets((prev) => [...prev, ...newPellets]);
  };

  const blowBubbles = (count = 10) => {
    const bowl = bowlRef.current;
    if (!bowl) return;
    const rect = bowl.getBoundingClientRect();
    const startY = rect.height - 80; // above gravel
    const newBubs: Bubble[] = Array.from({ length: count }).map(() => ({
      id: ++bubbleId,
      xPct: randomBetween(2, 98),
      yPx: startY + randomBetween(-8, 8),
      vy: randomBetween(120, 170), // px/s upward (fast)
      size: randomBetween(6, 14),
      opacity: randomBetween(0.7, 0.98),
    }));
    setBubbles((prev) => [...prev, ...newBubs]);
  };

  // Physics loop: pellets fall; bubbles rise; pellets collide; fish seek vertically toward nearest pellet
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // cap dt
      last = now;

      if (!paused) {
        const bowl = bowlRef.current;
        if (bowl) {
          const rect = bowl.getBoundingClientRect();
          const gravelHeight = 70; // keep in sync with CSS
          const bottomY = rect.height - gravelHeight;

          // Cache fish rects for collisions
          const fishRects: { id: number; rect: DOMRect }[] = [];
          fishRefs.forEach((el, id) => {
            if (!el) return;
            fishRects.push({ id, rect: el.getBoundingClientRect() });
          });

          // --- Pellets: fall & collide with any fish
          setPellets((prev) => {
            const next: Pellet[] = [];
            for (const p of prev) {
              let y = p.yPx + p.vy * dt; // fall

              // pellet rect in page coords
              const pelletPxX = (p.xPct / 100) * rect.width;
              const pelletRect = {
                left: rect.left + pelletPxX - p.size / 2,
                right: rect.left + pelletPxX + p.size / 2,
                top: rect.top + y,
                bottom: rect.top + y + p.size,
              };

              // collision with any fish?
              const hit = fishRects.some(({ rect: fr }) =>
                pelletRect.right >= fr.left &&
                pelletRect.left <= fr.right &&
                pelletRect.bottom >= fr.top &&
                pelletRect.top <= fr.bottom
              );
              if (hit) {
                // eaten
                continue;
              }

              // bottom reached?
              if (y >= bottomY - p.size) {
                // disappears at bottom
                continue;
              }
              next.push({ ...p, yPx: y });
            }
            return next;
          });

          // --- Bubbles: rise to top & despawn
          setBubbles((prev) => {
            const next: Bubble[] = [];
            for (const b of prev) {
              const y = b.yPx - b.vy * dt;
              if (y <= -b.size) continue; // off top
              next.push({ ...b, yPx: y });
            }
            return next;
          });

          // --- Fish seeking: gently move vertical position toward nearest pellet
          if (pellets.length > 0) {
            // Compute nearest pellet target depth for each fish by vertical distance
            const targets = new Map<number, number>(); // fishId -> target depth %
            for (const { id } of fishRects) {
              // find pellet with nearest yPx
              let bestPellet: Pellet | null = null;
              let bestDist = Infinity;
              for (const p of pellets) {
                const d = Math.abs(p.yPx - rect.height * ((fishDepths.get(id) ?? 50) / 100));
                if (d < bestDist) {
                  bestDist = d;
                  bestPellet = p;
                }
              }
              if (bestPellet) {
                const targetPct = Math.max(
                  5,
                  Math.min(95, (bestPellet.yPx / rect.height) * 100)
                );
                targets.set(id, targetPct);
              }
            }

            if (targets.size > 0) {
              setFishDepths((prev) => {
                const next = new Map(prev);
                const maxPctPerSec = 60; // how fast fish can move vertically
                const maxStep = maxPctPerSec * dt;

                fish.forEach((f) => {
                  const current = next.get(f.id) ?? f.depthPct;
                  const target = targets.get(f.id) ?? current;
                  const delta = target - current;
                  const step = Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep;
                  next.set(f.id, current + step);
                });

                return next;
              });
            }
          } else {
            // No pellets: ease fish back to their baseline cruising depths
            setFishDepths((prev) => {
              const next = new Map(prev);
              const easeBackPerSec = 20;
              const maxStep = easeBackPerSec * dt;

              fish.forEach((f) => {
                const current = next.get(f.id) ?? f.depthPct;
                const delta = f.depthPct - current;
                const step = Math.abs(delta) < maxStep ? delta : Math.sign(delta) * maxStep;
                next.set(f.id, current + step);
              });

              return next;
            });
          }
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [paused, pellets, fish, fishRefs, fishDepths]);

  return (
    <div className={`app-shell ${night ? "night" : "day"}`}>
      <header className="header">
        <h1 className="brand">Pixel Aquarium</h1>
        <div className="toggles">
          <label className="toggle">
            <input
              type="checkbox"
              checked={scanlines}
              onChange={(e) => setScanlines(e.target.checked)}
            />
            <span>Scanlines</span>
          </label>
          <label className="toggle">
            <input
              type="checkbox"
              checked={night}
              onChange={(e) => setNight(e.target.checked)}
            />
            <span>Night Mode</span>
          </label>
        </div>
      </header>

      <main className="layout">
        <section className="tank-card">
          <div
            ref={bowlRef}
            className={`fishbowl ${paused ? "paused" : ""} ${scanlines ? "scan" : ""}`}
            onClick={() => feed(3)}
            title="Click water to drop food pellets"
          >
            {/* animated caustics/light */}
            <div className="caustics" />
            {/* glass highlight */}
            <div className="glass-highlight" />
            {/* vignette */}
            <div className="vignette" />

            {/* Gravel & plants */}
            <div className="gravel" />
            <div className="plant plant-1" />
            <div className="plant plant-2" />
            <div className="plant plant-3" />

            {/* Dynamic bubbles */}
            <div className="bubble-layer">
              {bubbles.map((b) => (
                <div
                  key={b.id}
                  className="bubble"
                  style={{
                    left: `${b.xPct}%`,
                    top: `${b.yPx}px`,
                    width: `${b.size}px`,
                    height: `${b.size}px`,
                    opacity: b.opacity,
                  }}
                />
              ))}
            </div>

            {/* Food pellets with physics */}
            <div className="food-layer">
              {pellets.map((p) => (
                <div
                  key={p.id}
                  className="pellet"
                  style={{
                    left: `calc(${p.xPct}% - ${p.size / 2}px)`,
                    top: `${p.yPx}px`,
                    width: `${p.size}px`,
                    height: `${p.size}px`,
                  }}
                />
              ))}
            </div>

            {/* Fish */}
            {fish.map((f) => (
              <Fish
                key={f.id}
                spec={f}
                depthPct={fishDepths.get(f.id) ?? f.depthPct}
                paused={paused}
                globalSpeedMultiplier={speed}
                registerRef={registerFishRef}
              />
            ))}
          </div>

          <p className="hint">
            Click the water to drop pellets • Fish seek & eat pellets • Bubbles rise to surface • Toggle scanlines/night above
          </p>
        </section>

        <aside className="control-card">
          <h2>Controls</h2>

          <div className="row">
            <button onClick={() => setPaused((p) => !p)}>
              {paused ? "Resume" : "Pause"}
            </button>
            <button onClick={() => setFish((f) => [...f, makeFish(f.length)])}>Add Fish</button>
          </div>

          <div className="row">
            <button onClick={() => blowBubbles(14)}>Blow Bubbles</button>
            <button onClick={() => feed(7)}>Feed Fish</button>
          </div>

          <div className="slider-block">
            <label htmlFor="speed">Swim Speed</label>
            <input
              id="speed"
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
            />
            <div className="slider-caption">
              {speed < 1 ? "Chill" : speed > 1 ? "Energetic" : "Normal"}
            </div>
          </div>

          <div className="note">
            Fish now **seek** nearby food (vertical glide) and eat on contact; pellets fall a tad slower; turns are smoother.
          </div>
        </aside>
      </main>

      <footer className="footer">
        <span>© Pixel Aquarium • React + TypeScript • CSS + light physics</span>
      </footer>
    </div>
  );
};

export default App;
