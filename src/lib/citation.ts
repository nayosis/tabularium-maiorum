/*
 * Citation d'une source : de quoi retrouver l'acte (service d'archives, registre, cote, acte, vue, lien en ligne),
 * en une phrase à copier dans un courriel, un forum ou un autre logiciel.
 */
import { TYPES_ACTE } from "./libelles";

export type DonneesCitation = {
  acteId: string;
  titre: string;
  nature: string;
  type: string | null;
  numero: string | null;
  date: string | null;
  coteActe: string | null;
  acteLieu: string | null;
  registreTitre: string | null;
  periode: string | null;
  coteRegistre: string | null;
  archives: string | null;
  vue: string | null;
  url: string | null;
};

/** Types dont on dit « acte de … ». */
const ACTES = new Set(["naissance", "bapteme", "mariage", "deces", "sepulture", "reconnaissance", "legitimation"]);

function quoi(d: DonneesCitation) {
  if (d.nature === "photo") return "photographie";
  if (d.nature === "index") return "table";
  const libelle = TYPES_ACTE.find((t) => t.value === d.type)?.label.toLowerCase();
  if (!libelle) return "acte";
  return d.type && ACTES.has(d.type) ? `acte de ${libelle}` : libelle;
}

/**
 * « Archives départementales de Maine-et-Loire, Brissac — Naissances (1893-1902), cote 6 E 54/12 — acte de
 * naissance n° 45 du 29/11/1897, vue 12. En ligne : https://… »
 */
export function citation(d: DonneesCitation) {
  const registre = d.registreTitre
    ? [d.registreTitre + (d.periode && !d.registreTitre.includes(d.periode) ? ` (${d.periode})` : ""), d.coteRegistre && `cote ${d.coteRegistre}`]
        .filter(Boolean)
        .join(", ")
    : null;
  const source = [d.archives, registre].filter(Boolean).join(", ");
  const acte = [
    [quoi(d), d.numero && `n° ${d.numero}`, d.date && `du ${d.date}`, !d.registreTitre && d.acteLieu && `à ${d.acteLieu}`].filter(Boolean).join(" "),
    d.coteActe && d.coteActe !== d.coteRegistre && `cote ${d.coteActe}`,
    d.vue && `vue ${d.vue}`,
  ]
    .filter(Boolean)
    .join(", ");
  // Sans registre ni date, le titre du document est la meilleure description.
  const corps = source ? `${source} — ${acte}` : d.date || d.numero ? acte : `${d.titre}${d.vue ? `, vue ${d.vue}` : ""}`;
  return `${corps.charAt(0).toUpperCase()}${corps.slice(1)}.${d.url ? ` En ligne : ${d.url}` : ""}`;
}

/** Copier dans le presse-papiers, y compris en HTTP sur le réseau local (où l'API moderne est refusée). */
export async function copier(texte: string) {
  try {
    await navigator.clipboard.writeText(texte);
    return true;
  } catch {
    const zone = document.createElement("textarea");
    zone.value = texte;
    zone.style.position = "fixed";
    zone.style.opacity = "0";
    document.body.appendChild(zone);
    zone.select();
    const ok = document.execCommand("copy");
    zone.remove();
    return ok;
  }
}
