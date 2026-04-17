/**
 * main.tsx
 * Point d'entrée Vite/React : monte <App/> dans #root et importe le CSS global.
 */
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
