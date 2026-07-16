import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { initSentry, reactRootErrorHandlers } from "./telemetry.js";

const sentryEnabled = initSentry();

ReactDOM.createRoot(
  document.getElementById("root"),
  reactRootErrorHandlers(sentryEnabled),
).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
