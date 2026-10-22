/*
 * Vue « famille élargie » : on remonte jusqu'à une génération d'ancêtres, puis on redescend
 * depuis chacun d'eux. Apparaissent ainsi frères et sœurs, oncles et tantes, cousins, neveux…
 * Côté paternel d'abord (à gauche), côté maternel ensuite ; chaque personne n'est dessinée qu'une fois.
 */
import type { DonneesArbre } from "../../data/individus";
import { COLONNE, RANG, index, type Lien, type Noeud, type Personne } from "./disposition";

export type OptionsFamille = {
  /** 1 = parents (frères et sœurs), 2 = grands-parents (oncles, cousins germains), 3 = arrière-grands-parents. */
  remonter: number;
  /** Générations sous celle de la personne : 0 = sa génération, 1 = enfants et neveux, 2 = petits-enfants… */
  descendre: number;
};

/** Deux personnes d'un même couple, dessinées dans des branches différentes : trait pointillé entre elles. */
export type LienCouple = { a: Noeud; b: Noeud };

type Mots = [masculin: string, feminin: string, neutre: string];

/** Nom du lien de parenté selon (u = générations de la personne choisie à l'ancêtre commun, d = de l'ancêtre commun à l'autre). */
function motsParente(u: number, d: number): Mots | null {
  if (u === 0 && d === 0) return null;
  if (d === 0) {
    if (u === 1) return ["père", "mère", "parent"];
    if (u === 2) return ["grand-père", "grand-mère", "grand-parent"];
    if (u === 3) return ["arrière-grand-père", "arrière-grand-mère", "arrière-grand-parent"];
    return ["ancêtre", "ancêtre", "ancêtre"];
  }
  if (u === 0) {
    if (d === 1) return ["fils", "fille", "enfant"];
    if (d === 2) return ["petit-fils", "petite-fille", "petit-enfant"];
    if (d === 3) return ["arrière-petit-fils", "arrière-petite-fille", "arrière-petit-enfant"];
    return ["descendant", "descendante", "descendant"];
  }
  const cle = `${u},${d}`;
  const table: Record<string, Mots> = {
    "1,1": ["frère", "sœur", "frère ou sœur"],
    "1,2": ["neveu", "nièce", "neveu ou nièce"],
    "1,3": ["petit-neveu", "petite-nièce", "petit-neveu ou petite-nièce"],
    "2,1": ["oncle", "tante", "oncle ou tante"],
    "2,2": ["cousin germain", "cousine germaine", "cousin(e) germain(e)"],
    "2,3": ["petit-cousin", "petite-cousine", "petit(e)-cousin(e)"],
    "3,1": ["grand-oncle", "grand-tante", "grand-oncle ou grand-tante"],
    "3,2": ["cousin du parent", "cousine du parent", "cousin(e) du parent"],
    "3,3": ["cousin issu de germains", "cousine issue de germains", "cousin(e) issu(e) de germains"],
  };
  return table[cle] ?? ["parent éloigné", "parente éloignée", "parent(e) éloigné(e)"];
}

export function disposerFamille(d: DonneesArbre, racineId: string, opt: OptionsFamille) {
  const idx = index(d);
  const racine = idx.parId.get(racineId);
  if (!racine) return { noeuds: [] as Noeud[], liens: [] as Lien[], couples: [] as LienCouple[] };

  const parents = (id: string) => {
    const { pere, mere } = idx.pereMere(id);
    return [pere, mere].filter((p): p is Personne => !!p);
  };

  // Ancêtres par numéro Sosa, jusqu'à la génération demandée.
  const sosa = new Map<number, Personne>([[1, racine]]);
  for (let s = 1; s < 2 ** opt.remonter; s++) {
    const p = sosa.get(s);
    if (!p) continue;
    const { pere, mere } = idx.pereMere(p.id);
    if (pere) sosa.set(2 * s, pere);
    if (mere) sosa.set(2 * s + 1, mere);
  }

  // Têtes de branche : un couple (ou une personne) par ancêtre de la génération « remonter ».
  // Branche inconnue : on redescend vers le plus proche ancêtre connu (au pire la personne elle-même).
  type Tete = { chef: Personne; conjoint: Personne | null; gen: number };
  const tetes: Tete[] = [];
  const vuesTetes = new Set<string>();
  for (let k = 2 ** (opt.remonter - 1); k < 2 ** opt.remonter; k++) {
    const pere = sosa.get(2 * k);
    const mere = sosa.get(2 * k + 1);
    let tete: Tete | null = null;
    if (pere || mere) tete = { chef: (pere ?? mere)!, conjoint: pere && mere ? mere : null, gen: -opt.remonter };
    else {
      let s = k;
      while (s >= 1 && !sosa.get(s)) s = Math.floor(s / 2);
      if (s >= 1) tete = { chef: sosa.get(s)!, conjoint: null, gen: -Math.floor(Math.log2(s)) };
    }
    if (tete && !vuesTetes.has(tete.chef.id)) {
      vuesTetes.add(tete.chef.id);
      tetes.push(tete);
    }
  }

  const noeuds: Noeud[] = [];
  const liens: Lien[] = [];
  const places = new Map<string, Noeud>();
  let colonne = 0;

  const naissance = (p: Personne) => p.naissanceMin ?? "9999";
  const desc = (p: Personne, gen: number, enfantsDe: Personne[]): Noeud => {
    const n: Noeud = { cle: `f-${p.id}`, personne: p, conjoints: idx.conjoints(p.id), x: 0, y: gen * RANG || 0 };
    noeuds.push(n);
    places.set(p.id, n);
    const tous =
      gen < opt.descendre
        ? [...new Map(enfantsDe.flatMap((q) => idx.enfants(q.id)).map((e) => [e.id, e])).values()]
            .filter((e) => !places.has(e.id))
            .sort((a, b) => naissance(a).localeCompare(naissance(b)))
        : [];
    // Une seule personne (pas un couple de tête) : ses enfants regroupés par union.
    const { enfants, union } = enfantsDe.length === 1 ? idx.parUnion(p.id, tous) : { enfants: tous, union: null };
    if (!enfants.length) {
      n.x = colonne++;
      return n;
    }
    // Réserver les enfants avant de descendre : un demi-frère n'est pas redessiné sous l'autre parent.
    for (const e of enfants) places.set(e.id, n);
    const branches = enfants.map((e) => desc(e, gen + 1, [e]));
    branches.forEach((b, i) => liens.push({ parent: n, enfant: b, union: union?.get(enfants[i].id) }));
    n.x = (branches[0].x + branches[branches.length - 1].x) / 2;
    return n;
  };

  for (const t of tetes) {
    if (places.has(t.chef.id) && places.get(t.chef.id)!.personne?.id === t.chef.id) continue;
    desc(t.chef, t.gen, t.conjoint ? [t.chef, t.conjoint] : [t.chef]);
    colonne += 0.5; // un peu d'air entre les branches
  }

  // Centrer sur la personne choisie, convertir en unités.
  const centre = places.get(racineId)?.personne?.id === racineId ? places.get(racineId)!.x : 0;
  for (const n of noeuds) n.x = (n.x - centre) * COLONNE;

  // Liens de parenté avec la personne choisie : ancêtre commun le plus proche.
  const distancesAncetres = (id: string) => {
    const dist = new Map<string, number>([[id, 0]]);
    const file = [id];
    while (file.length) {
      const courant = file.shift()!;
      for (const p of parents(courant)) {
        if (!dist.has(p.id)) {
          dist.set(p.id, dist.get(courant)! + 1);
          file.push(p.id);
        }
      }
    }
    return dist;
  };
  const ancetresRacine = distancesAncetres(racineId);
  const parentsRacine = new Set(parents(racineId).map((p) => p.id));
  for (const n of noeuds) {
    const p = n.personne!;
    if (p.id === racineId) {
      n.racine = true;
      continue;
    }
    let meilleur: [number, number] | null = null;
    for (const [a, dist] of distancesAncetres(p.id)) {
      const u = ancetresRacine.get(a);
      if (u !== undefined && (!meilleur || u + dist < meilleur[0] + meilleur[1])) meilleur = [u, dist];
    }
    if (!meilleur) {
      n.parente = "par alliance";
      continue;
    }
    const mots = motsParente(meilleur[0], meilleur[1]);
    if (!mots) continue;
    let mot = p.sexe === "M" ? mots[0] : p.sexe === "F" ? mots[1] : mots[2];
    // Frère / sœur avec un seul parent en commun : demi.
    if (meilleur[0] === 1 && meilleur[1] === 1 && parents(p.id).filter((q) => parentsRacine.has(q.id)).length === 1) {
      mot = p.sexe === "F" ? "demi-sœur" : p.sexe === "M" ? "demi-frère" : "demi-frère ou demi-sœur";
    }
    n.parente = mot;
  }

  // Couples dessinés dans deux branches différentes (ex. les parents de la personne choisie).
  const couples: LienCouple[] = [];
  const vus = new Set<string>();
  for (const c of d.couples) {
    if (!c.b) continue;
    const a = places.get(c.a);
    const b = places.get(c.b);
    if (!a || !b || a === b || a.personne?.id !== c.a || b.personne?.id !== c.b) continue;
    const k = [c.a, c.b].sort().join("|");
    if (vus.has(k)) continue;
    vus.add(k);
    couples.push({ a, b });
  }

  return { noeuds, liens, couples };
}
