import { primeAffichee, withComputedPrime } from "./prime.util";

describe("withComputedPrime", () => {
  it("renvoie l'entrée telle quelle sans population", () => {
    const dto = { prime: 123 };
    expect(withComputedPrime(dto)).toBe(dto);
  });

  it("calcule la taxe de 8 % sur (H.T. + accessoires), arrondie au franc", () => {
    const r = withComputedPrime({
      nombreAssuresPrincipaux: 10,
      primeUnitaireAssurePrincipal: 100_000,
      montantAccessoires: 5_000,
    });
    expect(r.primeNette).toBe(1_000_000);
    expect(r.montantTaxe).toBe(80_400);
    expect(r.prime).toBe(1_085_400);
  });

  it("applique le prorata au jour sur 365 (date de fin non comptée)", () => {
    const r = withComputedPrime({
      nombreAssuresPrincipaux: 1,
      primeUnitaireAssurePrincipal: 365_000,
      dateDebut: "01/01/2025",
      dateFin: "11/01/2025",
    });
    expect(r.primeNette).toBe(10_000);
  });

  it("applique majoration puis réduction commerciale", () => {
    const r = withComputedPrime({
      nombreAssuresPrincipaux: 1,
      primeUnitaireAssurePrincipal: 100_000,
      tauxMinoMajoration: 10,
      tauxReductionCommerciale: 10,
    });
    expect(r.primeNette).toBe(99_000);
  });

  it("n'ajoute pas la commission à la prime TTC", () => {
    const r = withComputedPrime({
      nombreAssuresPrincipaux: 1,
      primeUnitaireAssurePrincipal: 100_000,
      tauxCommission: 10,
    });
    expect(r.montantCommission).toBe(10_000);
    expect(r.prime).toBe(108_000);
  });
});

describe("primeAffichee", () => {
  it("garde la prime du contrat si non nulle", () => {
    expect(primeAffichee(500, [{ numero: 1, prime: 100 }])).toBe(500);
  });
  it("retombe sur le dernier exercice ayant une prime", () => {
    expect(primeAffichee(0, [{ numero: 1, prime: 100 }, { numero: 2, prime: 0 }, { numero: 3, prime: 300 }])).toBe(300);
  });
});
