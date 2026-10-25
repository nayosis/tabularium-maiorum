import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./styles.css";

import React from "react";
import ReactDOM from "react-dom/client";
import { MantineProvider, createTheme } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { queryClient } from "./lib/query";
import { chargerSession } from "./lib/session";
import { chargerConfiguration } from "./lib/configuration";

const theme = createTheme({
  primaryColor: "teal",
  defaultRadius: "md",
  fontFamily: "Inter, Segoe UI, system-ui, sans-serif",
});

// Le compte connecté (et donc ses droits) est connu avant le premier affichage.
await Promise.all([
  chargerSession().catch((e) => console.error("Session illisible", e)),
  chargerConfiguration().catch((e) => console.error("Configuration illisible", e)),
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <Notifications position="bottom-right" />
      <QueryClientProvider client={queryClient}>
        <ModalsProvider labels={{ confirm: "Confirmer", cancel: "Annuler" }}>
          <RouterProvider router={router} />
        </ModalsProvider>
      </QueryClientProvider>
    </MantineProvider>
  </React.StrictMode>,
);
