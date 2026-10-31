import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applyStoredColorScheme } from "./lib/colorScheme";
import { installAccountRefusalWatcher } from "./lib/accountRefusal";

applyStoredColorScheme();
installAccountRefusalWatcher();

createRoot(document.getElementById("root")!).render(<App />);
