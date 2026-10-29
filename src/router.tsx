import { Outlet, createRootRoute, createRoute, createRouter, createBrowserHistory, redirect } from "@tanstack/react-router";
import { Layout } from "./components/Layout";
import { Accueil, Documents } from "./pages/Documents";
import { Atelier } from "./pages/atelier/Atelier";
import { Individus } from "./pages/Individus";
import { FicheIndividu } from "./pages/FicheIndividu";
import { Lieux } from "./pages/Lieux";
import { Arbre } from "./pages/arbre/Arbre";
import { Cartographie } from "./pages/cartographie/Cartographie";
import { Photos } from "./pages/photos/Photos";
import { Sauvegarde } from "./pages/Sauvegarde";
import { Recherches } from "./pages/Recherches";
import { Registre } from "./pages/registres/Registre";
import { Connexion } from "./pages/compte/Connexion";
import { Lien } from "./pages/compte/Lien";
import { Comptes } from "./pages/compte/Comptes";
import { Journal } from "./pages/compte/Journal";
import { Capturer } from "./pages/mobile/Capturer";
import { Presentation } from "./pages/accueil/Presentation";
import { Archives } from "./pages/Archives";
import { CalendrierRepublicain } from "./pages/aide/CalendrierRepublicain";
import { estAdmin, utilisateur } from "./lib/session";
import type { ReactNode } from "react";
import { SurOrdinateur } from "./components/SurOrdinateur";
import { useEcran } from "./lib/ecran";

/** Pages trop denses pour un téléphone : on y invite à passer sur ordinateur ou tablette. */
const surOrdinateur = (Page: () => ReactNode, titre: string) =>
  function PageSurOrdinateur() {
    return useEcran().telephone ? <SurOrdinateur titre={titre} /> : <Page />;
  };

const racine = createRootRoute({ component: Outlet });

/** Pages publiques : connexion, choix du mot de passe par lien. */
export const connexionRoute = createRoute({
  getParentRoute: () => racine,
  path: "/connexion",
  component: Connexion,
  validateSearch: (s: Record<string, unknown>): { retour?: string; email?: string } => ({
    ...(typeof s.retour === "string" ? { retour: s.retour } : {}),
    ...(typeof s.email === "string" ? { email: s.email } : {}),
  }),
});
export const lienRoute = createRoute({ getParentRoute: () => racine, path: "/lien/$jeton", component: Lien });

/** Tout le reste demande d'être connecté. */
const application = createRoute({
  getParentRoute: () => racine,
  id: "application",
  component: Layout,
  beforeLoad: ({ location }) => {
    if (!utilisateur()) throw redirect({ to: "/connexion", search: { retour: location.href } });
  },
});
const reserveAdmin = () => {
  if (!estAdmin()) throw redirect({ to: "/" });
};

const archives = createRoute({ getParentRoute: () => application, path: "/archives", component: Archives });
const calendrierRepublicain = createRoute({ getParentRoute: () => application, path: "/aide/calendrier-republicain", component: CalendrierRepublicain });
const presentation = createRoute({ getParentRoute: () => application, path: "/presentation", component: Presentation });
const capturer = createRoute({ getParentRoute: () => application, path: "/capturer", component: Capturer });
const accueil = createRoute({ getParentRoute: () => application, path: "/", component: Accueil });
const documents = createRoute({ getParentRoute: () => application, path: "/documents", component: Documents });

export const atelierRoute = createRoute({
  getParentRoute: () => application,
  path: "/actes/$acteId",
  component: Atelier,
  validateSearch: (s: Record<string, unknown>): { releve?: string } =>
    typeof s.releve === "string" ? { releve: s.releve } : {},
});

const individus = createRoute({ getParentRoute: () => application, path: "/individus", component: Individus });

export const ficheIndividuRoute = createRoute({
  getParentRoute: () => application,
  path: "/individus/$individuId",
  component: FicheIndividu,
});

export const arbreRoute = createRoute({
  getParentRoute: () => application,
  path: "/arbre",
  component: Arbre,
  validateSearch: (s: Record<string, unknown>): { racine?: string } =>
    typeof s.racine === "string" ? { racine: s.racine } : {},
});

export const cartographieRoute = createRoute({
  getParentRoute: () => application,
  path: "/cartographie",
  component: Cartographie,
  validateSearch: (s: Record<string, unknown>): { racine?: string } =>
    typeof s.racine === "string" ? { racine: s.racine } : {},
});

// Les registres sont désormais présentés avec les documents.
const registres = createRoute({
  getParentRoute: () => application,
  path: "/registres",
  beforeLoad: () => {
    throw redirect({ to: "/documents" });
  },
});

export const registreRoute = createRoute({
  getParentRoute: () => application,
  path: "/registres/$sourceId",
  component: Registre,
});

const photos = createRoute({ getParentRoute: () => application, path: "/photos", component: Photos });

const recherches = createRoute({ getParentRoute: () => application, path: "/recherches", component: Recherches });

const sauvegarde = createRoute({ getParentRoute: () => application, path: "/sauvegarde", component: surOrdinateur(Sauvegarde, "Sauvegarde"), beforeLoad: reserveAdmin });

const comptes = createRoute({ getParentRoute: () => application, path: "/comptes", component: surOrdinateur(Comptes, "Comptes"), beforeLoad: reserveAdmin });

const journal = createRoute({ getParentRoute: () => application, path: "/journal", component: surOrdinateur(Journal, "Journal"), beforeLoad: reserveAdmin });

export type FiltreLieux = "tous" | "personnes" | "actes" | "registres" | "inutilises" | "non-places" | "sans-insee";
const FILTRES_LIEUX: FiltreLieux[] = ["tous", "personnes", "actes", "registres", "inutilises", "non-places", "sans-insee"];
export const lieuxRoute = createRoute({
  getParentRoute: () => application,
  path: "/lieux",
  component: surOrdinateur(Lieux, "Lieux"),
  validateSearch: (s: Record<string, unknown>): { filtre?: FiltreLieux; lieu?: string } => ({
    ...(FILTRES_LIEUX.includes(s.filtre as FiltreLieux) && { filtre: s.filtre as FiltreLieux }),
    ...(typeof s.lieu === "string" && { lieu: s.lieu }),
  }),
});

export const router = createRouter({
  routeTree: racine.addChildren([
    connexionRoute,
    lienRoute,
    application.addChildren([
      accueil, documents, presentation, calendrierRepublicain, archives, capturer, atelierRoute, registres, registreRoute, individus, ficheIndividuRoute, arbreRoute, cartographieRoute, photos, recherches,
      lieuxRoute, sauvegarde, comptes, journal,
    ]),
  ]),
  history: createBrowserHistory(),
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
