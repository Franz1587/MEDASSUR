import DOMPurify from "dompurify";

const BALISES_AUTORISEES = [
  "p", "br", "hr", "div", "span", "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "small", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
  "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "a", "img", "font",
];

const ATTRIBUTS_AUTORISES = ["href", "title", "target", "rel", "src", "alt", "width", "height", "colspan", "rowspan", "span", "style", "color", "face", "size", "align"];

// http(s), mailto pour les liens ; http(s) et data:image pour les images. Tout le reste
// (javascript:, vbscript:, data:text/html...) est supprimé.
const URI_AUTORISEES = /^(?:https?:|mailto:|data:image\/(?:png|jpe?g|gif|webp|bmp);base64,|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i;

let initialise = false;

function initialiser() {
  if (initialise) return;
  initialise = true;
  DOMPurify.addHook("afterSanitizeAttributes", (noeud) => {
    if (noeud.tagName === "A") {
      const href = noeud.getAttribute("href");
      if (href && !/^(?:https?:|mailto:)/i.test(href.trim())) noeud.removeAttribute("href");
      noeud.setAttribute("rel", "noopener noreferrer nofollow");
      if (noeud.getAttribute("target") !== "_blank") noeud.removeAttribute("target");
    }
    if (noeud.tagName === "IMG") {
      const src = noeud.getAttribute("src") ?? "";
      if (!/^(?:https?:\/\/|data:image\/(?:png|jpe?g|gif|webp|bmp);base64,)/i.test(src.trim())) noeud.remove();
    }
    // Pas de styles pouvant charger des ressources externes ou exécuter du code.
    const style = noeud.getAttribute?.("style");
    if (style && /url\s*\(|expression\s*\(|javascript:|@import|behavior|-moz-binding/i.test(style)) noeud.removeAttribute("style");
  });
}

// Assainit un HTML riche (éditeur, courrier, emails entrants) avant tout
// dangerouslySetInnerHTML / innerHTML / srcDoc. Liste blanche stricte : pas de
// script, style, iframe, object, embed, form, ni attributs on*.
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return "";
  initialiser();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: BALISES_AUTORISEES,
    ALLOWED_ATTR: ATTRIBUTS_AUTORISES,
    ALLOWED_URI_REGEXP: URI_AUTORISEES,
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form", "input", "button", "textarea", "select", "link", "meta", "base", "svg", "math"],
    FORBID_ATTR: ["srcset", "formaction", "action", "xlink:href"],
    USE_PROFILES: { html: true },
  });
}
