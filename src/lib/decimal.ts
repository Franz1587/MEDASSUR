/** Prisma serializes Decimal fields as strings over JSON. */
export function toNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value);
}
