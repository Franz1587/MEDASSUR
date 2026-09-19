import type { MouseEvent } from "react";
import { toast } from "sonner";

export function Btn({ children, variant = "secondary", onClick, className = "", disabled = false }: {
  children: React.ReactNode; variant?: "primary" | "secondary" | "ghost";
  onClick?: () => void; className?: string; disabled?: boolean;
}) {
  const base = "inline-flex items-center gap-2 px-3.5 py-2 text-sm rounded-xl font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100";
  const variants = {
    primary: "bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(13,115,191,0.3)] hover:brightness-95 active:scale-[0.99]",
    secondary: "bg-card/90 border border-border text-muted-foreground hover:text-foreground hover:border-primary/35 hover:bg-secondary/45",
    ghost: "text-muted-foreground hover:text-foreground hover:bg-secondary/55",
  };
  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick();
      return;
    }
    event.preventDefault();
    toast.info("Action prise en compte", {
      description: "Cette commande est bien active et prête à être reliée à un flux métier spécifique.",
    });
  };

  return <button type="button" disabled={disabled} className={`${base} ${variants[variant]} ${className}`} onClick={handleClick}>{children}</button>;
}
