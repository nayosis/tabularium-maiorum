import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex, type AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import type { Militaire } from "../lib/militaire";

/*
 * Modèle : Source (registre) → Page (image) ↔ Acte → Relevé (personne telle qu'écrite)
 *                                                     └→ Individu (conclusion)
 * Dates floues : `x` = saisie d'origine ("vers 1826"), `xMin`/`xMax` = bornes ISO calculées.
 */

const id = () => text("id").primaryKey();
const creeLe = () => text("cree_le").notNull().default(sql`(datetime('now'))`);

/**
 * Qui a créé / modifié la ligne, et quand (ISO, à la milliseconde). Remplies par le serveur
 * (déclencheurs SQLite, cf. serveur/tracabilite.ts) ; `modifieLe` sert aussi de version (conflits).
 */
const tracabilite = () => ({
  creePar: text("cree_par"),
  modifiePar: text("modifie_par"),
  modifieLe: text("modifie_le"),
});


export const lieu = sqliteTable("lieu", {
  id: id(),
  nom: text("nom").notNull(),
  departement: text("departement"),
  codeInsee: text("code_insee"),
  latitude: real("latitude"),
  longitude: real("longitude"),
  notes: text("notes"),
  creeLe: creeLe(),
    ...tracabilite(),
});

/**
 * Un registre ou fonds d'archives (ex. « Table décennale Verruyes 1873-1882 », AD79).
 * Sert de référence pour les actes enregistrés comme pour les consultations sans résultat.
 */
export const source = sqliteTable("source", {
  id: id(),
  titre: text("titre").notNull(),
  typeRegistre: text("type_registre"),
  lieuId: text("lieu_id").references(() => lieu.id, { onDelete: "set null" }),
  periode: text("periode"),
  serviceArchives: text("service_archives"),
  cote: text("cote"),
  /** Où consulter la source en ligne. */
  url: text("url"),
  notes: text("notes"),
  creeLe: creeLe(),
    ...tracabilite(),
});

/** Une vue / image (généralement une page de registre). */
export const page = sqliteTable("page", {
  id: id(),
  sourceId: text("source_id").references(() => source.id, { onDelete: "set null" }),
  fichier: text("fichier").notNull(),
  largeur: integer("largeur").notNull(),
  hauteur: integer("hauteur").notNull(),
  numeroVue: text("numero_vue"),
  notes: text("notes"),
  creeLe: creeLe(),
});

export const acte = sqliteTable(
  "acte",
  {
    id: id(),
    sourceId: text("source_id").references(() => source.id, { onDelete: "set null" }),
    /**
     * « acte » : un acte (naissance, mariage…), sur une ou plusieurs images ;
     * « index » : une page de table ou de répertoire (table décennale…), dont chaque ligne renvoie à un acte.
     */
    nature: text("nature").notNull().default("acte"),
    /** Type d'acte (nature acte) ou type d'index (nature index). */
    type: text("type"),
    numero: text("numero"),
    date: text("date"),
    dateMin: text("date_min"),
    dateMax: text("date_max"),
    lieuId: text("lieu_id").references(() => lieu.id, { onDelete: "set null" }),
    titre: text("titre").notNull(),
    cote: text("cote"),
    transcription: text("transcription"),
    traduction: text("traduction"),
    statut: text("statut").notNull().default("a_analyser"),
    notes: text("notes"),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("acte_statut_idx").on(t.statut)],
);

/** Un acte peut s'étendre sur plusieurs pages, une page peut contenir plusieurs actes. */
export const actePage = sqliteTable(
  "acte_page",
  {
    acteId: text("acte_id").notNull().references(() => acte.id, { onDelete: "cascade" }),
    pageId: text("page_id").notNull().references(() => page.id, { onDelete: "cascade" }),
    ordre: integer("ordre").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.acteId, t.pageId] })],
);

/** Liens internet (où le document a été trouvé). */
export const lien = sqliteTable("lien", {
  id: id(),
  acteId: text("acte_id").references(() => acte.id, { onDelete: "cascade" }),
  pageId: text("page_id").references(() => page.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  libelle: text("libelle"),
  creeLe: creeLe(),
});

export const individu = sqliteTable("individu", {
  id: id(),
  nom: text("nom"),
  prenoms: text("prenoms"),
  sexe: text("sexe"),
  naissance: text("naissance"),
  naissanceMin: text("naissance_min"),
  naissanceMax: text("naissance_max"),
  naissanceLieuId: text("naissance_lieu_id").references(() => lieu.id, { onDelete: "set null" }),
  deces: text("deces"),
  decesMin: text("deces_min"),
  decesMax: text("deces_max"),
  decesLieuId: text("deces_lieu_id").references(() => lieu.id, { onDelete: "set null" }),
  acteNaissanceId: text("acte_naissance_id").references(() => acte.id, { onDelete: "set null" }),
  acteDecesId: text("acte_deces_id").references(() => acte.id, { onDelete: "set null" }),
  profession: text("profession"),
  /** Parent déclaré inconnu dans les actes (≠ pas encore trouvé). */
  pereInconnu: integer("pere_inconnu", { mode: "boolean" }).notNull().default(false),
  mereInconnue: integer("mere_inconnue", { mode: "boolean" }).notNull().default(false),
  /** Aucune union connue ni à chercher (mort jeune, célibataire…) : pas d'acte de mariage attendu. */
  sansUnion: integer("sans_union", { mode: "boolean" }).notNull().default(false),
  /** Portrait : la zone d'une photo où la personne est identifiée. */
  portraitAnnotationId: text("portrait_annotation_id").references((): AnySQLiteColumn => annotation.id, { onDelete: "set null" }),
  notes: text("notes"),
  creeLe: creeLe(),
    ...tracabilite(),
});

/** Une personne telle qu'elle apparaît dans un acte. */
export const releve = sqliteTable(
  "releve",
  {
    id: id(),
    acteId: text("acte_id").notNull().references(() => acte.id, { onDelete: "cascade" }),
    individuId: text("individu_id").references(() => individu.id, { onDelete: "set null" }),
    role: text("role"),
    nomEcrit: text("nom_ecrit"),
    prenomsEcrits: text("prenoms_ecrits"),
    nom: text("nom"),
    prenoms: text("prenoms"),
    sexe: text("sexe"),
    age: text("age"),
    naissance: text("naissance"),
    naissanceMin: text("naissance_min"),
    naissanceMax: text("naissance_max"),
    naissanceLieu: text("naissance_lieu"),
    mariage: text("mariage"),
    mariageMin: text("mariage_min"),
    mariageMax: text("mariage_max"),
    mariageLieu: text("mariage_lieu"),
    deces: text("deces"),
    decesMin: text("deces_min"),
    decesMax: text("deces_max"),
    decesLieu: text("deces_lieu"),
    profession: text("profession"),
    domicile: text("domicile"),
    origine: text("origine"),
    signature: text("signature"),
    relations: text("relations"),
    confiance: text("confiance"),
    notes: text("notes"),
    /** Relevé d'index : l'acte vers lequel renvoie la ligne, une fois trouvé. */
    acteRenvoiId: text("acte_renvoi_id").references(() => acte.id, { onDelete: "set null" }),
    /** Registre matricule : classe, matricule, signalement, décision, services, adresses successives. */
    militaire: text("militaire", { mode: "json" }).$type<Militaire>(),
    ordre: integer("ordre").notNull().default(0),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("releve_acte_idx").on(t.acteId), index("releve_individu_idx").on(t.individuId)],
);

export type Rect = { x: number; y: number; w: number; h: number };

/** Zone surlignée sur une page (1..N rectangles), reliée à un relevé ou portant une note. */
export const annotation = sqliteTable(
  "annotation",
  {
    id: id(),
    pageId: text("page_id").notNull().references(() => page.id, { onDelete: "cascade" }),
    acteId: text("acte_id").references(() => acte.id, { onDelete: "cascade" }),
    releveId: text("releve_id").references(() => releve.id, { onDelete: "cascade" }),
    rectangles: text("rectangles", { mode: "json" }).$type<Rect[]>().notNull(),
    note: text("note"),
    texteBulle: text("texte_bulle"),
    couleur: text("couleur"),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("annotation_page_idx").on(t.pageId)],
);

/** Couple (mariage, union libre…). « union » est un mot réservé SQL. */
export const couple = sqliteTable("couple", {
  id: id(),
  individu1Id: text("individu1_id").notNull().references(() => individu.id, { onDelete: "cascade" }),
  individu2Id: text("individu2_id").references(() => individu.id, { onDelete: "cascade" }),
  type: text("type"),
  date: text("date"),
  dateMin: text("date_min"),
  dateMax: text("date_max"),
  lieuId: text("lieu_id").references(() => lieu.id, { onDelete: "set null" }),
  /** Acte de mariage de l'union. */
  acteId: text("acte_id").references(() => acte.id, { onDelete: "set null" }),
  notes: text("notes"),
  creeLe: creeLe(),
    ...tracabilite(),
});

export const filiation = sqliteTable(
  "filiation",
  {
    id: id(),
    enfantId: text("enfant_id").notNull().references(() => individu.id, { onDelete: "cascade" }),
    parentId: text("parent_id").notNull().references(() => individu.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("biologique"),
    /** Acte qui établit le lien (naissance, reconnaissance, légitimation…). */
    acteId: text("acte_id").references(() => acte.id, { onDelete: "set null" }),
    notes: text("notes"),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [uniqueIndex("filiation_unique").on(t.enfantId, t.parentId)],
);

/** Une recherche : un objectif (ex. « naissance vers 1877 autour d'Allonne ») et son journal de consultations. */
export const tache = sqliteTable("tache", {
  id: id(),
  titre: text("titre").notNull(),
  /** naissance, mariage, deces, autre */
  type: text("type"),
  description: text("description"),
  statut: text("statut").notNull().default("a_faire"),
  resultat: text("resultat"),
  individuId: text("individu_id").references(() => individu.id, { onDelete: "set null" }),
  acteId: text("acte_id").references(() => acte.id, { onDelete: "set null" }),
  sourceId: text("source_id").references(() => source.id, { onDelete: "set null" }),
  creeLe: creeLe(),
    ...tracabilite(),
  termineLe: text("termine_le"),
});

/**
 * Doute : deux fiches qui sont peut-être la même personne, sans les fusionner.
 * Paire rangée (individu1_id < individu2_id) et unique. Statut : a_verifier, ou differentes une fois vérifié
 * (gardé, avec la note, pour s'en souvenir). « Même personne » se règle par la fusion, qui supprime le doute.
 */
export const doute = sqliteTable(
  "doute",
  {
    id: id(),
    individu1Id: text("individu1_id").notNull().references(() => individu.id, { onDelete: "cascade" }),
    individu2Id: text("individu2_id").notNull().references(() => individu.id, { onDelete: "cascade" }),
    statut: text("statut").notNull().default("a_verifier"),
    note: text("note"),
    /** Recherche ouverte pour lever le doute. */
    tacheId: text("tache_id").references(() => tache.id, { onDelete: "set null" }),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [uniqueIndex("doute_paire").on(t.individu1Id, t.individu2Id), index("doute_individu2_idx").on(t.individu2Id)],
);

/**
 * Annuaire des archives : liens ajoutés, corrigés ou masqués par l'utilisateur, par-dessus la liste fournie
 * (src/lib/archives.ts). `defaut` = adresse du lien fourni que cette ligne remplace (ou masque).
 */
export const lienArchives = sqliteTable("lien_archives", {
  id: id(),
  /** Code du département (« 49 », « 2A ») ou « national ». */
  departement: text("departement").notNull(),
  categorie: text("categorie").notNull(),
  libelle: text("libelle").notNull(),
  url: text("url"),
  defaut: text("defaut"),
  masque: integer("masque", { mode: "boolean" }).notNull().default(false),
  creeLe: creeLe(),
  ...tracabilite(),
});

/** Une source consultée pour une recherche, et ce qu'on y a trouvé (ou pas). */
export const consultation = sqliteTable(
  "consultation",
  {
    id: id(),
    tacheId: text("tache_id").notNull().references(() => tache.id, { onDelete: "cascade" }),
    sourceId: text("source_id").references(() => source.id, { onDelete: "set null" }),
    /** Date de la consultation (AAAA-MM-JJ). */
    date: text("date").notNull(),
    /** rien, trouve, piste, lacune */
    resultat: text("resultat").notNull().default("rien"),
    /** Lien vers la vue exacte consultée (permalien du site d'archives). */
    permalien: text("permalien"),
    /** Vue(s) consultée(s), ex. « 12 à 15 ». */
    vues: text("vues"),
    notes: text("notes"),
    creeLe: creeLe(),
    ...tracabilite(),
  },
  (t) => [index("consultation_tache_idx").on(t.tacheId), index("consultation_source_idx").on(t.sourceId)],
);

export type Lieu = typeof lieu.$inferSelect;
export type Source = typeof source.$inferSelect;
export type Page = typeof page.$inferSelect;
export type Acte = typeof acte.$inferSelect;
export type Lien = typeof lien.$inferSelect;
export type Individu = typeof individu.$inferSelect;
export type Releve = typeof releve.$inferSelect;
export type Annotation = typeof annotation.$inferSelect;
export type Couple = typeof couple.$inferSelect;
export type Filiation = typeof filiation.$inferSelect;
export type Tache = typeof tache.$inferSelect;
export type Consultation = typeof consultation.$inferSelect;
export type Doute = typeof doute.$inferSelect;

/** Journal des modifications : une ligne par action d'écriture (fonction appelée, par qui, sur quoi). */
export const journal = sqliteTable(
  "journal",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    quand: text("quand").notNull(),
    utilisateur: text("utilisateur").notNull(),
    fonction: text("fonction").notNull(),
    cible: text("cible"),
    resume: text("resume"),
  },
  (t) => [index("journal_quand_idx").on(t.quand), index("journal_utilisateur_idx").on(t.utilisateur)],
);
