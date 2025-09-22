import React, { useState } from "react";
import "./App.css";

const App: React.FC = () => {
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(6); // seconds for one full trip

  return (
    <div className="app-container">
      <h1 className="title">🐠 Retro Fishbowl</h1>
      <p className="description">
        Watch the goldfish swim back and forth. Click the fish to pause/resume,
        or use the controls below to change its speed.
      </p>

      <div className="fishbowl">
        <div
          className={`fish ${paused ? "paused" : ""}`}
          style={{ animationDuration: `${speed}s` }}
          onClick={() => setPaused(!paused)}
          title="Click me to pause/resume!"
        >
          🐟
        </div>
      </div>

      <div className="controls">
        <button onClick={() => setPaused(!paused)}>
          {paused ? "Resume" : "Pause"}
        </button>
        <button onClick={() => setSpeed((s) => Math.max(2, s - 2))}>
          Faster
        </button>
        <button onClick={() => setSpeed((s) => s + 2)}>Slower</button>
      </div>
    </div>
  );
};

export default App;
