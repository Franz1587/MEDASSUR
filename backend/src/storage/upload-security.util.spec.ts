import { sanitizeUpload } from "./upload-security.util";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
const PDF = Buffer.from("%PDF-1.7\n" + "x".repeat(40));

describe("sanitizeUpload", () => {
  it("accepte un PNG valide et génère un nom aléatoire", () => {
    const r = sanitizeUpload({ originalName: "photo.png", mimetype: "image/png", buffer: PNG, category: "image" });
    expect(r.ext).toBe(".png");
    expect(r.storedName).toMatch(/^[0-9a-f-]{36}\.png$/);
  });

  it("refuse un HTML déguisé en image", () => {
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    expect(() => sanitizeUpload({ originalName: "x.png", mimetype: "image/png", buffer: html, category: "image" })).toThrow();
  });

  it.each(["x.html", "x.svg", "x.js", "x.exe"])("refuse l'extension %s", (nom) => {
    expect(() => sanitizeUpload({ originalName: nom, mimetype: "text/html", buffer: PDF, category: "document" })).toThrow();
  });

  it("refuse un SVG même pour un logo", () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'><script>1</script></svg>");
    expect(() => sanitizeUpload({ originalName: "logo.svg", mimetype: "image/svg+xml", buffer: svg, category: "logo" })).toThrow();
  });

  it("refuse un fichier dont le contenu ne correspond pas à l'extension", () => {
    expect(() => sanitizeUpload({ originalName: "a.pdf", mimetype: "application/pdf", buffer: PNG, category: "document" })).toThrow();
  });

  it("accepte un PDF valide et ignore le MIME déclaré", () => {
    const r = sanitizeUpload({ originalName: "../../etc/passwd.pdf", mimetype: "text/html", buffer: PDF, category: "document" });
    expect(r.mime).toBe("application/pdf");
    expect(r.storedName).not.toContain("..");
  });

  it("refuse un fichier trop gros", () => {
    expect(() => sanitizeUpload({ originalName: "a.pdf", buffer: PDF, category: "document", maxBytes: 10 })).toThrow();
  });
});
