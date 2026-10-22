import { useId } from "react";
import { urlImage } from "../lib/images";
import { cadrePortrait, type Portrait as DonneesPortrait } from "../lib/portrait";

const initiales = (nom?: string | null, prenoms?: string | null) =>
  [(prenoms ?? "").trim()[0], (nom ?? "").trim()[0]].filter(Boolean).join("").toUpperCase() || "?";

const COULEUR_SEXE: Record<string, string> = { M: "#1c7ed6", F: "#d6336c" };

type Props = {
  portrait: DonneesPortrait | null;
  taille: number;
  /** Rond (avatar) ou carré arrondi (vignette). */
  rond?: boolean;
  nom?: string | null;
  prenoms?: string | null;
  sexe?: string | null;
};

/** Image de la photo recadrée sur la zone de la personne ; initiales s'il n'y a pas de portrait. */
export function Portrait({ portrait, taille, rond = true, nom, prenoms, sexe }: Props) {
  const couleur = COULEUR_SEXE[sexe ?? ""] ?? "#868e96";
  const forme: React.CSSProperties = {
    width: taille,
    height: taille,
    borderRadius: rond ? "50%" : 8,
    flexShrink: 0,
    overflow: "hidden",
    display: "block",
  };
  if (!portrait) {
    return (
      <div
        style={{
          ...forme,
          background: `${couleur}22`,
          color: couleur,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 700,
          fontSize: taille * 0.38,
        }}
      >
        {initiales(nom, prenoms)}
      </div>
    );
  }
  const c = cadrePortrait(portrait.rects, portrait.largeur, portrait.hauteur);
  return (
    <svg viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} preserveAspectRatio="xMidYMid slice" style={{ ...forme, boxShadow: `0 0 0 2px ${couleur}` }}>
      <image href={urlImage(portrait.fichier)} x={0} y={0} width={portrait.largeur} height={portrait.hauteur} />
    </svg>
  );
}

/** Même portrait, à placer dans un dessin SVG (cases de l'arbre) : rond de rayon `r` centré en (cx, cy). */
export function PortraitSvg({ portrait, cx, cy, r, couleur }: { portrait: DonneesPortrait; cx: number; cy: number; r: number; couleur: string }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const c = cadrePortrait(portrait.rects, portrait.largeur, portrait.hauteur);
  return (
    <g>
      <clipPath id={`portrait-${id}`}>
        <circle cx={cx} cy={cy} r={r} />
      </clipPath>
      {/* Découpe ronde appliquée dans le repère du dessin (un groupe), pas dans celui de l'image. */}
      <g clipPath={`url(#portrait-${id})`}>
        <svg x={cx - r} y={cy - r} width={2 * r} height={2 * r} viewBox={`${c.x} ${c.y} ${c.w} ${c.h}`} preserveAspectRatio="xMidYMid slice">
          <image href={urlImage(portrait.fichier)} x={0} y={0} width={portrait.largeur} height={portrait.hauteur} />
        </svg>
      </g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={couleur} strokeWidth={2} />
    </g>
  );
}
