import { appelApi, ErreurServeur } from "./rpc";
import { definirLectureSeule } from "./mode";

export type Role = "lecture" | "ecriture" | "admin";
export type Moi = { id: string; email: string; role: Role; super: boolean; individuId: string | null };

let moi: Moi | null = null;

/** Utilisateur connecté (null avant connexion). Fixé au démarrage, avant le premier affichage. */
export const utilisateur = () => moi;
export const estAdmin = () => !!moi && (moi.super || moi.role === "admin");

export const LIBELLES_ROLES: Record<Role, string> = { lecture: "Lecture", ecriture: "Écriture", admin: "Admin" };

/** Lit la session en cours (cookie) ; null si personne n'est connecté. */
export async function chargerSession() {
  try {
    const { utilisateur: u } = await appelApi<{ utilisateur: Moi }>("/api/auth/moi", { silencieux: true });
    moi = u;
  } catch (e) {
    if (!(e instanceof ErreurServeur && e.statut === 401)) throw e;
    moi = null;
  }
  definirLectureSeule(moi?.role === "lecture" && !moi.super);
  return moi;
}

export async function connexion(email: string, motDePasse: string, souvenir: boolean) {
  await appelApi("/api/auth/connexion", { corps: { email, motDePasse, souvenir }, silencieux: true });
}

/** Crée le compte administrateur au premier lancement (et ouvre la session). */
export async function installer(email: string, motDePasse: string) {
  await appelApi("/api/auth/installation", { corps: { email, motDePasse }, silencieux: true });
}

/** Déconnexion, puis rechargement complet sur la page de connexion (aucune donnée ne reste en mémoire). */
export async function deconnexion() {
  await appelApi("/api/auth/deconnexion", { corps: {} }).catch(() => undefined);
  location.assign("/connexion");
}
