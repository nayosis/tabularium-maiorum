/** Ouvre un lien externe (archives en ligne, permalien) dans un nouvel onglet du navigateur. */
export function openUrl(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}
