import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

// On native iOS, env(safe-area-inset-top) returns 0 in Capacitor's WKWebView.
// Use the native plugin to get the actual values, with a hardcoded fallback.
if (Capacitor.isNativePlatform()) {
  // Immediate fallback: 60px covers all Dynamic Island iPhones
  document.body.style.paddingTop = "60px";
  document.body.style.paddingBottom = "34px";

  // Then try to get exact values from native API
  import("capacitor-plugin-safe-area")
    .then(({ SafeArea }) => SafeArea.getSafeAreaInsets())
    .then(({ insets }) => {
      if (insets.top > 0) document.body.style.paddingTop = `${insets.top}px`;
      if (insets.bottom > 0) document.body.style.paddingBottom = `${insets.bottom}px`;
    })
    .catch(() => {
      // Plugin failed, keep the 60px/34px fallback
    });
}

createRoot(document.getElementById("root")!).render(<App />);
