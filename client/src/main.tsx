import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

// On native iOS/Android, read the actual safe area insets from the OS
// and inject them as CSS custom properties. This is the reliable fallback
// when env(safe-area-inset-*) returns 0 in certain Capacitor configs.
if (Capacitor.isNativePlatform()) {
  import("capacitor-plugin-safe-area").then(({ SafeArea }) => {
    SafeArea.getSafeAreaInsets().then(({ insets }) => {
      const style = document.documentElement.style;
      style.setProperty("--safe-area-inset-top", `${insets.top}px`);
      style.setProperty("--safe-area-inset-bottom", `${insets.bottom}px`);
      style.setProperty("--safe-area-inset-left", `${insets.left}px`);
      style.setProperty("--safe-area-inset-right", `${insets.right}px`);
    });

    // Listen for changes (e.g. rotation)
    SafeArea.addListener("safeAreaChanged", ({ insets }) => {
      const style = document.documentElement.style;
      style.setProperty("--safe-area-inset-top", `${insets.top}px`);
      style.setProperty("--safe-area-inset-bottom", `${insets.bottom}px`);
      style.setProperty("--safe-area-inset-left", `${insets.left}px`);
      style.setProperty("--safe-area-inset-right", `${insets.right}px`);
    });
  });
}

createRoot(document.getElementById("root")!).render(<App />);
