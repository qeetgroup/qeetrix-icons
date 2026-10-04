import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { iconManifest } from "../../src/generated/icon-manifest.js";
import { App } from "./app.js";
import { buildCatalogue } from "./catalogue.js";
import { iconModules } from "./icon-modules.js";
import "./styles.css";

const root = document.getElementById("root");
if (!root) throw new Error("The playground needs a #root element.");

createRoot(root).render(
  <StrictMode>
    <App catalogue={buildCatalogue(iconManifest, iconModules)} />
  </StrictMode>,
);
