import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

// On native iOS, tell the status bar NOT to overlay the WebView.
// This makes the WebView start BELOW the status bar/Dynamic Island,
// eliminating all safe-area-top issues across every iPhone model.
if (Capacitor.isNativePlatform()) {
  import("@capacitor/status-bar").then(({ StatusBar, Style }) => {
    StatusBar.setOverlaysWebView({ overlay: false });
    StatusBar.setStyle({ style: Style.Dark });
    StatusBar.setBackgroundColor({ color: "#ffffff" });
  }).catch(() => {
    // Plugin not available, ignore
  });
}

createRoot(document.getElementById("root")!).render(<App />);
