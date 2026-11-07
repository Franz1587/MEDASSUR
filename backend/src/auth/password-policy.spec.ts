import { estMotDePasseConforme } from "./password-policy";

describe("estMotDePasseConforme", () => {
  it.each([
    ["Abcdefgh12", true],
    ["abcdefgh1!", true],
    ["ABCDEFGH1!", true],
    ["abcdefghij", false],
    ["Abc1!", false],
    ["abcdefgh12", false],
    ["medassur2024", false],
  ])("%s -> %s", (mdp, attendu) => {
    expect(estMotDePasseConforme(mdp)).toBe(attendu);
  });

  it("refuse les valeurs non textuelles et trop longues", () => {
    expect(estMotDePasseConforme(undefined)).toBe(false);
    expect(estMotDePasseConforme(12345678901)).toBe(false);
    expect(estMotDePasseConforme("Aa1!" + "x".repeat(130))).toBe(false);
  });
});
