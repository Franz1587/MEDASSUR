// Plafond unitaire d'une opération Mobile Money / carte (FCFA). Surchargeable via
// EBILLING_MAX_MONTANT (entier positif) sans redéploiement du code.
const maxEnv = Number(process.env.EBILLING_MAX_MONTANT);
export const EBILLING_MAX_MONTANT = Number.isInteger(maxEnv) && maxEnv > 0 ? maxEnv : 50_000_000;

export const OPERATEURS_PAYIN = ["AIRTELMONEY", "MOOVMONEY4", "VISA_MASTERCARD", "SIMU"] as const;
export const OPERATEURS_PAYOUT = ["airtelmoney", "moovmoney4"] as const;

// Gabon (06/07 + 6-7 chiffres, ou +241…) ou E.164 générique ; espaces/tirets retirés par le DTO.
export const MSISDN_REGEX = /^(\+[1-9]\d{7,14}|0\d{7,9})$/;

export const MAX_BORDEREAUX_PAR_PAYOUT = 50;
export const DESCRIPTION_MAX = 200;
