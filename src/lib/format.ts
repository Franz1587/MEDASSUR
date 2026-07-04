export function fmt(n: number) {
  return new Intl.NumberFormat("fr-FR").format(n) + " XAF";
}

export function fmtM(n: number) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + "Md";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}
