import { createRoot } from "react-dom/client";
import App from "./App";
// Stesso carattere del PDF (shared/contract-document.ts)
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
