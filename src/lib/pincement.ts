/**
 * Zoom à deux doigts : suit les pointeurs posés et, quand deux sont actifs, donne à chaque mouvement
 * le facteur de zoom (écart actuel / écart précédent) et le centre (milieu des deux doigts).
 * Indépendant de l'affichage : l'arbre et les visionneuses s'en servent avec leur propre `zoomer`.
 */
type Point = { pointerId: number; clientX: number; clientY: number };

export function creerPincement() {
  const pointeurs = new Map<number, { x: number; y: number }>();
  let precedent: number | null = null;

  const mesure = () => {
    const [a, b] = [...pointeurs.values()];
    return { ecart: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
  };

  return {
    poser(e: Point) {
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      precedent = pointeurs.size === 2 ? mesure().ecart : null;
    },
    retirer(e: Pick<Point, "pointerId">) {
      pointeurs.delete(e.pointerId);
      precedent = null;
    },
    /** Deux doigts posés : un pincement est en cours (le glisser et le toucher sont alors ignorés). */
    actif: () => pointeurs.size >= 2,
    /** Mouvement d'un doigt ; renvoie le zoom à appliquer, ou null s'il n'y a pas de pincement. */
    bouger(e: Point): { facteur: number; cx: number; cy: number } | null {
      if (!pointeurs.has(e.pointerId)) return null;
      pointeurs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointeurs.size !== 2) return null;
      const m = mesure();
      if (!precedent || !m.ecart) {
        precedent = m.ecart || null;
        return null;
      }
      const facteur = m.ecart / precedent;
      precedent = m.ecart;
      return { facteur, cx: m.cx, cy: m.cy };
    },
  };
}
