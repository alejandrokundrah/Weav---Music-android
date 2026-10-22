import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";

import "./ui/styles/global.css";
import { applyPlatformAttributes } from "./ui/platform";
import NotchPlayer from "./ui/components/notch/NotchPlayer";
import { applyPaperPcMode, hydratePaperPcMode } from "./ui/settings/paperPcMode";
import {
  applyRenderEffects,
  hydrateRenderEffects,
  useReduceMotion,
} from "./ui/settings/renderEffects";

applyPlatformAttributes();
/*
 * The notch is its own window, so it is its own document: none of the attributes main.tsx
 * stamps on <html> exist here. Reduced motion and paper-PC mode read the same durable keys in
 * every window, so they agree without the windows talking to each other.
 */
applyPaperPcMode();
applyRenderEffects();
void Promise.all([hydratePaperPcMode(), hydrateRenderEffects()]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <NotchRoot />
  </React.StrictMode>,
);

function NotchRoot() {
  const reduce = useReduceMotion();
  return (
    <MotionConfig reducedMotion={reduce ? "always" : "user"}>
      <NotchPlayer />
    </MotionConfig>
  );
}
