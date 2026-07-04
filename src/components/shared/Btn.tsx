export function Btn({ children, variant = "secondary", onClick, className = "" }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void; className?: string;
}) {
  const base = "flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium transition-all";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:opacity-90",
    secondary: "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/30",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
  };
  return <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick}>{children}</button>;
}
