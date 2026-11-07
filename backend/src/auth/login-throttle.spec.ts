import { LoginThrottle, TropDeTentativesException, ipClient } from "./login-throttle";

describe("LoginThrottle", () => {
  it("bloque un compte après 8 échecs depuis la même IP", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 8; i++) {
      t.verifier("1.1.1.1", "a@b.ga");
      t.enregistrerEchec("1.1.1.1", "a@b.ga");
    }
    expect(() => t.verifier("1.1.1.1", "a@b.ga")).toThrow(TropDeTentativesException);
  });

  it("ne bloque pas une autre IP ou un autre identifiant", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 8; i++) t.enregistrerEchec("1.1.1.1", "a@b.ga");
    expect(() => t.verifier("2.2.2.2", "a@b.ga")).not.toThrow();
    expect(() => t.verifier("1.1.1.1", "autre@b.ga")).not.toThrow();
  });

  it("un succès remet le compteur du compte à zéro", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 7; i++) t.enregistrerEchec("1.1.1.1", "a@b.ga");
    t.enregistrerSucces("1.1.1.1", "a@b.ga");
    for (let i = 0; i < 7; i++) t.enregistrerEchec("1.1.1.1", "a@b.ga");
    expect(() => t.verifier("1.1.1.1", "a@b.ga")).not.toThrow();
  });

  it("bloque une IP qui essaie beaucoup de comptes (password spraying)", () => {
    const t = new LoginThrottle();
    for (let i = 0; i < 40; i++) t.enregistrerEchec("3.3.3.3", `u${i}@b.ga`);
    expect(() => t.verifier("3.3.3.3", "nouveau@b.ga")).toThrow(TropDeTentativesException);
  });
});

describe("ipClient", () => {
  const ancien = process.env.TRUST_PROXY;
  afterEach(() => {
    if (ancien === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = ancien;
  });

  it("ignore X-Forwarded-For sans TRUST_PROXY", () => {
    delete process.env.TRUST_PROXY;
    expect(ipClient({ headers: { "x-forwarded-for": "9.9.9.9" }, socket: { remoteAddress: "5.5.5.5" } })).toBe("5.5.5.5");
  });

  it("utilise le premier élément de X-Forwarded-For avec TRUST_PROXY", () => {
    process.env.TRUST_PROXY = "1";
    expect(ipClient({ headers: { "x-forwarded-for": "9.9.9.9, 8.8.8.8" }, socket: { remoteAddress: "5.5.5.5" } })).toBe("9.9.9.9");
  });
});
