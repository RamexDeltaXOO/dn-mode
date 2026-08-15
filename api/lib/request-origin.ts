/**
 * Origine publique de la requete entrante.
 *
 * Derriere le CDN d'App Hosting, la revision Cloud Run recoit la requete en
 * clair : `req.url` porte alors le schema `http` et parfois un hote interne.
 * Utiliser cette valeur telle quelle produit une URI de redirection OAuth en
 * `http://`, que Google rejette avec `redirect_uri_mismatch`.
 *
 * On reconstruit donc l'origine a partir des en-tetes de proxy standard, en
 * retombant sur `req.url` quand ils sont absents (developpement local).
 */
export function originFromRequest(req: Request): string {
  const headers = req.headers;

  // Ces en-tetes peuvent contenir une liste "valeur1, valeur2" : le client
  // d'origine est toujours le premier element.
  const firstValue = (raw: string | null): string =>
    (raw ?? "").split(",")[0].trim();

  const host = firstValue(headers.get("x-forwarded-host")) || firstValue(headers.get("host"));
  let proto = firstValue(headers.get("x-forwarded-proto"));

  if (!host) {
    try {
      return new URL(req.url).origin;
    } catch {
      return "";
    }
  }

  if (proto !== "http" && proto !== "https") {
    try {
      proto = new URL(req.url).protocol.replace(":", "");
    } catch {
      proto = "";
    }
  }

  // Hors developpement local, une origine publique est forcement en https.
  if (proto !== "http" && proto !== "https") proto = "https";
  const isLocal = host.startsWith("localhost:") || host.startsWith("127.0.0.1:");
  if (!isLocal && proto === "http") proto = "https";

  return `${proto}://${host}`;
}
