/*
 * Navigation et mémoire des pages, avec les onglets du navigateur :
 * l'état d'une page (filtres, sections dépliées, défilement) est gardé dans le sessionStorage,
 * propre à chaque onglet ; on le retrouve en revenant sur la page (retour, rechargement).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { router } from "../router";

const PREFIXE = "tabularium.memoire.";

const lire = (cle: string): { ok: boolean; valeur?: unknown } => {
  try {
    const v = sessionStorage.getItem(PREFIXE + cle);
    return v === null ? { ok: false } : { ok: true, valeur: JSON.parse(v) };
  } catch {
    return { ok: false };
  }
};
const ecrireMemoire = (cle: string, valeur: unknown) => {
  try {
    sessionStorage.setItem(PREFIXE + cle, JSON.stringify(valeur));
  } catch {
    // stockage indisponible : l'état ne sera simplement pas retrouvé
  }
};

/** Fixe à l'avance une valeur mémorisée (ex. : déplier la recherche qu'on vient de créer). */
export const memoriser = (cle: string, valeur: unknown) => ecrireMemoire(cle, valeur);

/** Comme useState, mais retrouvé en revenant sur la page (dans le même onglet du navigateur). */
export function useMemoire<T>(cle: string, defaut: T) {
  const [valeur, setValeur] = useState<T>(() => {
    const m = lire(cle);
    return m.ok ? (m.valeur as T) : defaut;
  });
  // La clé peut changer sans démontage (autre fiche dans la même page).
  const derniere = useRef(cle);
  useEffect(() => {
    if (derniere.current === cle) return;
    derniere.current = cle;
    const m = lire(cle);
    setValeur(m.ok ? (m.valeur as T) : defaut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cle]);
  const modifier = useCallback(
    (v: T | ((prec: T) => T)) =>
      setValeur((prec) => {
        const suivante = typeof v === "function" ? (v as (p: T) => T)(prec) : v;
        ecrireMemoire(cle, suivante);
        return suivante;
      }),
    [cle],
  );
  return [valeur, modifier] as const;
}

/**
 * Position de défilement d'une ScrollArea, retrouvée en revenant sur la page.
 * `pret` : le contenu est chargé (on ne peut défiler qu'une fois la page à sa hauteur).
 */
export function useDefilement(cle: string, pret = true) {
  const complete = `defilement.${cle}`;
  const viewportRef = useRef<HTMLDivElement>(null);
  const restaure = useRef(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    if (!pret || restaure.current) return;
    restaure.current = true;
    const m = lire(complete);
    if (m.ok && typeof m.valeur === "number" && m.valeur > 0) {
      const y = m.valeur;
      requestAnimationFrame(() => viewportRef.current?.scrollTo({ top: y }));
    }
  }, [pret, complete]);
  const onScrollPositionChange = useCallback(
    ({ y }: { y: number }) => {
      if (!restaure.current) return;
      clearTimeout(minuteur.current);
      minuteur.current = setTimeout(() => ecrireMemoire(complete, y), 150);
    },
    [complete],
  );
  return { viewportRef, onScrollPositionChange };
}

/**
 * Clic sur une ligne de tableau ou une carte : Ctrl+clic ou clic molette ouvre un nouvel onglet
 * du navigateur, sinon on navigue normalement.
 */
export function clicOuvrir(e: React.MouseEvent, href: string) {
  if (e.button === 1 || e.ctrlKey || e.metaKey) {
    e.preventDefault();
    window.open(href, "_blank");
  } else if (e.button === 0) router.history.push(href);
}

/** Bouton retour : page précédente de l'application dans cet onglet, sinon `defaut`. */
export function retour(defaut: string) {
  if (router.history.canGoBack()) router.history.back();
  else router.history.push(defaut);
}

/** Change de page sans l'ajouter à l'historique (feuilleter un registre : « retour » ramène à la liste). */
export const remplacer = (href: string) => router.history.replace(href);
