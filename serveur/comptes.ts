/*
 * Comptes, sessions et liens (création / réinitialisation du mot de passe), dans comptes.db :
 * séparée de la base généalogique, elle n'est ni sauvegardée ni restaurée avec elle.
 */
import { Database } from "bun:sqlite";

export type Role = "lecture" | "ecriture" | "admin";
export const ROLES: Role[] = ["lecture", "ecriture", "admin"];

export type Utilisateur = {
  id: string;
  email: string;
  role: Role;
  super: boolean;
  individuId: string | null;
  actif: boolean;
  aMotDePasse: boolean;
  creeLe: string;
  derniereConnexion: string | null;
};

export const DUREE_LIEN_MS = 48 * 3600 * 1000;
export const DUREE_SESSION_COURTE_MS = 12 * 3600 * 1000;
export const DUREE_SESSION_LONGUE_MS = 30 * 24 * 3600 * 1000;
export const LONGUEUR_MIN_MOT_DE_PASSE = 10;

let base: Database;

export function ouvrirComptes(chemin: string) {
  base = new Database(chemin, { create: true });
  base.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;");
  base.exec(`
    CREATE TABLE IF NOT EXISTS utilisateur (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL CHECK (role IN ('lecture', 'ecriture', 'admin')),
      mot_de_passe TEXT,
      super INTEGER NOT NULL DEFAULT 0,
      individu_id TEXT,
      actif INTEGER NOT NULL DEFAULT 1,
      cree_le TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
      derniere_connexion TEXT
    );
    CREATE TABLE IF NOT EXISTS session (
      jeton_hash TEXT PRIMARY KEY,
      utilisateur_id TEXT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
      expire_le INTEGER NOT NULL,
      souvenir INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS lien (
      jeton_hash TEXT PRIMARY KEY,
      utilisateur_id TEXT NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('creation', 'reinitialisation')),
      expire_le INTEGER NOT NULL,
      utilise_le INTEGER
    );
  `);
  return base;
}

const hacherJeton = (jeton: string) => new Bun.CryptoHasher("sha256").update(jeton).digest("hex");
const nouveauJeton = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
export const normaliserEmail = (email: string) => email.trim().toLowerCase();
export const emailValide = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

type Ligne = {
  id: string;
  email: string;
  role: Role;
  mot_de_passe: string | null;
  super: number;
  individu_id: string | null;
  actif: number;
  cree_le: string;
  derniere_connexion: string | null;
};
const versUtilisateur = (l: Ligne): Utilisateur => ({
  id: l.id,
  email: l.email,
  role: l.role,
  super: !!l.super,
  individuId: l.individu_id,
  actif: !!l.actif,
  aMotDePasse: !!l.mot_de_passe,
  creeLe: l.cree_le,
  derniereConnexion: l.derniere_connexion,
});

const ligneParId = (id: string) => base.query<Ligne, [string]>("SELECT * FROM utilisateur WHERE id = ?").get(id);
const ligneParEmail = (email: string) => base.query<Ligne, [string]>("SELECT * FROM utilisateur WHERE email = ?").get(normaliserEmail(email));

export const utilisateurParId = (id: string) => {
  const l = ligneParId(id);
  return l ? versUtilisateur(l) : null;
};
export const listeUtilisateurs = () =>
  base.query<Ligne, []>("SELECT * FROM utilisateur ORDER BY super DESC, email").all().map(versUtilisateur);

/** Lien en attente (non utilisé, non expiré) pour chaque compte : date d'expiration. */
export function liensEnAttente() {
  const lignes = base
    .query<{ utilisateur_id: string; type: string; expire_le: number }, [number]>(
      "SELECT utilisateur_id, type, max(expire_le) AS expire_le FROM lien WHERE utilise_le IS NULL AND expire_le > ? GROUP BY utilisateur_id",
    )
    .all(Date.now());
  return new Map(lignes.map((l) => [l.utilisateur_id, { type: l.type, expireLe: l.expire_le }]));
}

// --- Mots de passe

export const hacherMotDePasse = (mdp: string) => Bun.password.hash(mdp, { algorithm: "argon2id" });

export function verifierLongueur(mdp: string) {
  if (mdp.length < LONGUEUR_MIN_MOT_DE_PASSE) throw new Error(`Le mot de passe doit faire au moins ${LONGUEUR_MIN_MOT_DE_PASSE} caractères.`);
}

let leurre: Promise<string> | null = null;

/** Vérifie e-mail et mot de passe ; renvoie l'utilisateur, ou null (sans dire lequel des deux est faux). */
export async function verifierIdentifiants(email: string, mdp: string) {
  const l = ligneParEmail(email);
  if (!l || !l.mot_de_passe || !l.actif) {
    // Temps de calcul comparable, que le compte existe ou non (ne pas révéler les adresses connues).
    leurre ??= hacherMotDePasse(crypto.randomUUID());
    await Bun.password.verify(mdp, await leurre);
    return null;
  }
  return (await Bun.password.verify(mdp, l.mot_de_passe)) ? versUtilisateur(l) : null;
}

export async function changerMotDePasse(id: string, mdp: string) {
  verifierLongueur(mdp);
  base.query("UPDATE utilisateur SET mot_de_passe = ? WHERE id = ?").run(await hacherMotDePasse(mdp), id);
}

// --- Comptes

export function creerUtilisateur(email: string, role: Role, individuId: string | null = null) {
  const e = normaliserEmail(email);
  if (!emailValide(e)) throw new Error("Adresse e-mail invalide.");
  if (ligneParEmail(e)) throw new Error("Un compte existe déjà avec cette adresse.");
  const id = crypto.randomUUID();
  base.query("INSERT INTO utilisateur (id, email, role, individu_id) VALUES (?, ?, ?, ?)").run(id, e, role, individuId);
  return utilisateurParId(id)!;
}

export function modifierUtilisateur(id: string, patch: { role?: Role; actif?: boolean; individuId?: string | null }) {
  if (patch.role !== undefined) base.query("UPDATE utilisateur SET role = ? WHERE id = ?").run(patch.role, id);
  if (patch.actif !== undefined) {
    base.query("UPDATE utilisateur SET actif = ? WHERE id = ?").run(patch.actif ? 1 : 0, id);
    if (!patch.actif) supprimerSessions(id);
  }
  if (patch.individuId !== undefined) base.query("UPDATE utilisateur SET individu_id = ? WHERE id = ?").run(patch.individuId, id);
  return utilisateurParId(id);
}

export const supprimerUtilisateur = (id: string) => base.query("DELETE FROM utilisateur WHERE id = ?").run(id);

export const nbUtilisateurs = () => base.query<{ n: number }, []>("SELECT count(*) AS n FROM utilisateur").get()!.n;

/**
 * Premier lancement, sans aucun compte : la personne qui installe Tabularium crée le super admin.
 * Refusé dès qu'un compte existe.
 */
export async function installerPremierAdmin(email: string, mdp: string) {
  const e = normaliserEmail(email);
  if (!emailValide(e)) throw new Error("Adresse e-mail invalide.");
  verifierLongueur(mdp);
  const hache = await hacherMotDePasse(mdp);
  const id = crypto.randomUUID();
  // Vérification et création d'un seul tenant : deux installations simultanées ne créent pas deux comptes.
  base.transaction(() => {
    if (nbUtilisateurs() > 0) throw new Error("Tabularium est déjà installé.");
    base.query("INSERT INTO utilisateur (id, email, role, mot_de_passe, super) VALUES (?, ?, 'admin', ?, 1)").run(id, e, hache);
  })();
  return utilisateurParId(id)!;
}

/**
 * Super admin défini par l'environnement (docker-compose), facultatif : créé au premier démarrage,
 * mot de passe remis à jour s'il a changé. Il ne peut être ni modifié ni supprimé depuis l'application.
 */
export async function installerSuperAdmin(email: string | undefined, mdp: string | undefined) {
  // Sans variables d'environnement : le super admin est créé à l'écran, au premier lancement.
  if (!email || !mdp) return;
  const e = normaliserEmail(email);
  verifierLongueur(mdp);
  // Un seul super admin : celui de l'environnement.
  base.query("UPDATE utilisateur SET super = 0 WHERE super = 1 AND email <> ?").run(e);
  const existant = ligneParEmail(e);
  if (!existant) {
    base
      .query("INSERT INTO utilisateur (id, email, role, mot_de_passe, super) VALUES (?, ?, 'admin', ?, 1)")
      .run(crypto.randomUUID(), e, await hacherMotDePasse(mdp));
    return;
  }
  const memeMotDePasse = existant.mot_de_passe ? await Bun.password.verify(mdp, existant.mot_de_passe) : false;
  base
    .query("UPDATE utilisateur SET role = 'admin', super = 1, actif = 1, mot_de_passe = ? WHERE id = ?")
    .run(memeMotDePasse ? existant.mot_de_passe : await hacherMotDePasse(mdp), existant.id);
}

// --- Sessions

export function creerSession(utilisateurId: string, souvenir: boolean) {
  const jeton = nouveauJeton();
  const expire = Date.now() + (souvenir ? DUREE_SESSION_LONGUE_MS : DUREE_SESSION_COURTE_MS);
  base.query("DELETE FROM session WHERE expire_le < ?").run(Date.now());
  base.query("INSERT INTO session (jeton_hash, utilisateur_id, expire_le, souvenir) VALUES (?, ?, ?, ?)").run(
    hacherJeton(jeton),
    utilisateurId,
    expire,
    souvenir ? 1 : 0,
  );
  base.query("UPDATE utilisateur SET derniere_connexion = ? WHERE id = ?").run(new Date().toISOString(), utilisateurId);
  return { jeton, expire };
}

/** Utilisateur de la session (actif, non expirée), ou null. Une session « souvenir » est prolongée à l'usage. */
export function lireSession(jeton: string | undefined) {
  if (!jeton) return null;
  const h = hacherJeton(jeton);
  const s = base
    .query<{ utilisateur_id: string; expire_le: number; souvenir: number }, [string]>(
      "SELECT utilisateur_id, expire_le, souvenir FROM session WHERE jeton_hash = ?",
    )
    .get(h);
  if (!s || s.expire_le < Date.now()) return null;
  const u = utilisateurParId(s.utilisateur_id);
  if (!u || !u.actif) return null;
  if (s.souvenir && s.expire_le - Date.now() < DUREE_SESSION_LONGUE_MS / 2) {
    base.query("UPDATE session SET expire_le = ? WHERE jeton_hash = ?").run(Date.now() + DUREE_SESSION_LONGUE_MS, h);
  }
  return u;
}

export const supprimerSession = (jeton: string) => base.query("DELETE FROM session WHERE jeton_hash = ?").run(hacherJeton(jeton));
export const supprimerSessions = (utilisateurId: string) => base.query("DELETE FROM session WHERE utilisateur_id = ?").run(utilisateurId);

// --- Liens à usage unique (48 h)

export function creerLien(utilisateurId: string, type: "creation" | "reinitialisation") {
  // Un nouveau lien annule les précédents encore valables.
  base.query("DELETE FROM lien WHERE utilisateur_id = ? AND utilise_le IS NULL").run(utilisateurId);
  const jeton = nouveauJeton();
  const expire = Date.now() + DUREE_LIEN_MS;
  base.query("INSERT INTO lien (jeton_hash, utilisateur_id, type, expire_le) VALUES (?, ?, ?, ?)").run(hacherJeton(jeton), utilisateurId, type, expire);
  return { jeton, expire };
}

export const annulerLiens = (utilisateurId: string) => base.query("DELETE FROM lien WHERE utilisateur_id = ? AND utilise_le IS NULL").run(utilisateurId);

/** Lien encore valable : son type et le compte concerné ; null sinon (inconnu, expiré, déjà utilisé, compte désactivé). */
export function lireLien(jeton: string) {
  const l = base
    .query<{ utilisateur_id: string; type: "creation" | "reinitialisation"; expire_le: number; utilise_le: number | null }, [string]>(
      "SELECT utilisateur_id, type, expire_le, utilise_le FROM lien WHERE jeton_hash = ?",
    )
    .get(hacherJeton(jeton));
  if (!l || l.utilise_le || l.expire_le < Date.now()) return null;
  const u = utilisateurParId(l.utilisateur_id);
  if (!u || !u.actif) return null;
  return { type: l.type, utilisateur: u };
}

/** Définit le mot de passe grâce au lien, puis le marque utilisé et ferme les autres sessions. */
export async function utiliserLien(jeton: string, mdp: string) {
  const l = lireLien(jeton);
  if (!l) throw new Error("Ce lien n'est plus valable (déjà utilisé ou expiré). Demandez-en un nouveau.");
  await changerMotDePasse(l.utilisateur.id, mdp);
  base.query("UPDATE lien SET utilise_le = ? WHERE jeton_hash = ?").run(Date.now(), hacherJeton(jeton));
  supprimerSessions(l.utilisateur.id);
  return l.utilisateur;
}
