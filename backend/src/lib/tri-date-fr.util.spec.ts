import { cleDateFr, cleDateSoinsFacture, trierParDate } from "./tri-date-fr.util";

describe("cleDateFr", () => {
  it("lit JJ/MM/AAAA, J/M/AAAA et ISO", () => {
    expect(cleDateFr("05/02/2026")).toBe(20260205);
    expect(cleDateFr("5/2/2026")).toBe(20260205);
    expect(cleDateFr("2026-02-05T10:00:00Z")).toBe(20260205);
  });
  it("renvoie null pour une valeur illisible", () => {
    expect(cleDateFr("")).toBeNull();
    expect(cleDateFr(null)).toBeNull();
    expect(cleDateFr("n/a")).toBeNull();
  });
});

describe("trierParDate", () => {
  const cle = (s: string) => cleDateFr(s);

  it("trie chronologiquement, pas par jour du mois", () => {
    const dates = ["30/01/2026", "05/02/2026", "15/12/2025"];
    expect(trierParDate(dates, cle, "desc")).toEqual(["05/02/2026", "30/01/2026", "15/12/2025"]);
    expect(trierParDate(dates, cle, "asc")).toEqual(["15/12/2025", "30/01/2026", "05/02/2026"]);
  });

  it("place toujours les dates illisibles en dernier et reste stable", () => {
    const items = ["x", "10/01/2026", "y", "10/01/2026"];
    expect(trierParDate(items, cle, "desc")).toEqual(["10/01/2026", "10/01/2026", "x", "y"]);
    expect(trierParDate(items, cle, "asc")).toEqual(["10/01/2026", "10/01/2026", "x", "y"]);
  });
});

describe("cleDateSoinsFacture", () => {
  it("prend la date de soins la plus récente des lignes", () => {
    expect(cleDateSoinsFacture({ dateReception: "01/03/2026", lignes: [{ date: "10/01/2026" }, { date: "25/02/2026" }] })).toBe(20260225);
  });
  it("retombe sur la date de réception sans ligne datée", () => {
    expect(cleDateSoinsFacture({ dateReception: "01/03/2026", lignes: [] })).toBe(20260301);
  });
});
