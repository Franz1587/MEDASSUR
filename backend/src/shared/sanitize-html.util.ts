import sanitizeHtml from "sanitize-html";

const BALISES_AUTORISEES = [
  "p", "br", "hr", "div", "span", "b", "strong", "i", "em", "u", "s", "strike", "sub", "sup", "small", "mark",
  "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
  "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "colgroup", "col",
  "a", "img", "font",
];

const STYLES_AUTORISES: Record<string, RegExp[]> = {
  "text-align": [/^(left|right|center|justify)$/i],
  color: [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
  "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgba?\([\d\s.,%]+\)$/i, /^[a-z]+$/i],
  "font-weight": [/^(normal|bold|bolder|lighter|[1-9]00)$/i],
  "font-style": [/^(normal|italic|oblique)$/i],
  "text-decoration": [/^(none|underline|line-through)$/i],
  "font-size": [/^[\d.]+(px|pt|em|rem|%)$/i],
  width: [/^[\d.]+(px|%|em)$/i],
  "padding-left": [/^[\d.]+(px|pt|em|rem)$/i],
};

// Liste blanche stricte du HTML riche stocké (éditeur de texte, emails entrants) :
// ni script/style/iframe/object/embed/form, ni attribut on*, liens http/https/mailto,
// images http/https/data:image uniquement. Voir src/lib/sanitizeHtml.ts côté front.
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: BALISES_AUTORISEES,
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    font: ["color", "face", "size"],
    p: ["align", "style"], div: ["align", "style"],
    td: ["colspan", "rowspan", "style"],
    th: ["colspan", "rowspan", "style"],
    col: ["span", "style"],
    "*": ["style"],
  },
  allowedStyles: { "*": STYLES_AUTORISES },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https", "data"] },
  allowProtocolRelative: false,
  disallowedTagsMode: "discard",
  nonTextTags: ["script", "style", "textarea", "option", "noscript", "iframe", "object", "embed"],
  transformTags: {
    a: (tagName, attribs) => {
      const href = attribs.href;
      const out: Record<string, string> = { rel: "noopener noreferrer nofollow" };
      if (href) out.href = href;
      if (attribs.title) out.title = attribs.title;
      if (attribs.target === "_blank") out.target = "_blank";
      return { tagName, attribs: out };
    },
  },
  exclusiveFilter: (frame) => {
    // data: n'est toléré que pour des images raster/svg encodées en base64 (jamais text/html).
    if (frame.tag === "img") {
      const src = frame.attribs.src ?? "";
      return !src || (/^data:/i.test(src) && !/^data:image\/(png|jpe?g|gif|webp|bmp);base64,/i.test(src));
    }
    return false;
  },
};

export function sanitizeHtmlRiche(html: string): string {
  return sanitizeHtml(html, OPTIONS);
}

// Variante pour champs facultatifs : null/undefined/chaîne vide restent inchangés.
export function sanitizeHtmlOptionnel<T extends string | null | undefined>(html: T): T {
  if (typeof html !== "string" || html === "") return html;
  return sanitizeHtmlRiche(html) as T;
}
