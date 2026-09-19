import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router";
import { useInternalNavigation } from "@/navigation/InternalNavigationContext";

export function BackButton({
  fallbackTo = "/",
  className = "",
  onBack,
  label,
}: {
  fallbackTo?: string;
  className?: string;
  onBack?: () => void;
  label?: string;
}) {
  const navigate = useNavigate();
  const internalNavigation = useInternalNavigation();

  const handleBack = () => {
    if (onBack) {
      onBack();
      return;
    }

    const target = internalNavigation?.goBack();
    if (target) {
      navigate(target);
      return;
    }
    navigate(fallbackTo, { replace: true });
  };

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label="Retour à la page précédente"
      title="Retour"
      className={`inline-flex items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors ${className}`}
    >
      <ArrowLeft className="w-4 h-4" />
      {label && <span>{label}</span>}
    </button>
  );
}