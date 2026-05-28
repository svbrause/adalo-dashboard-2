import React from "react";
import ReactDOM from "react-dom/client";
import { ClinicDemoDeck } from "./ClinicDemoDeck";
import "./clinicDemoDeck.css";

ReactDOM.createRoot(
  document.getElementById("clinic-demo-deck-root") as HTMLElement,
).render(
  <React.StrictMode>
    <ClinicDemoDeck />
  </React.StrictMode>,
);
