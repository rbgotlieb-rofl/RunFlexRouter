import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";
import App from "./App";
import "./index.css";

// When running as a native iOS/Android app, add a class so CSS can apply
// fixed safe-area padding (env() returns 0 with contentInset: 'never')
if (Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("native-app");
}

createRoot(document.getElementById("root")!).render(<App />);
