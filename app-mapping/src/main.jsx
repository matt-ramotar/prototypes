import {StrictMode} from "react";
import {createRoot} from "react-dom/client";
import {Toast} from "@heroui/react";

import App from "./App.jsx";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Toast.Provider placement="bottom-end" />
    <App />
  </StrictMode>,
);
