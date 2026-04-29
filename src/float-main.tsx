import { createRoot } from "react-dom/client";
import FloatApp from "./components/FloatApp";
import "./index.css";

createRoot(document.getElementById("float-root")!).render(<FloatApp />);
