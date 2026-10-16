import { createRoot } from "react-dom/client";
import FloatApp from "./components/FloatApp";
import "./index.css";
import { ThemeProvider } from "./components/ThemeProvider";

createRoot(document.getElementById("float-root")!).render(<ThemeProvider><FloatApp /></ThemeProvider>);
