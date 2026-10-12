import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getMesClients, type ClientSociete } from "@/services/portailPrestataire.service";

// Contexte société cliente active pour le portail prestataire (2026-10) —
// voir demande utilisateur : "permettre au prestataire de sélectionner pour
// le compte de quel client il veut faire l'identification de l'assuré".
// Un prestataire physique peut servir plusieurs sociétés MEDASSUR+
// (compagnies, courtiers, mutuelles) sans jamais mélanger leurs données.
interface ClientSocieteCtx {
  clients: ClientSociete[];
  clientActif: ClientSociete | null;
  setClientActif: (c: ClientSociete) => void;
  pret: boolean;
}

const Ctx = createContext<ClientSocieteCtx>({ clients: [], clientActif: null, setClientActif: () => {}, pret: false });

export function ClientSocieteProvider({ children }: { children: ReactNode }) {
  const [clients, setClients] = useState<ClientSociete[]>([]);
  const [clientActif, setClientActif] = useState<ClientSociete | null>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    getMesClients().then((list) => {
      setClients(list);
      if (list.length === 1) { setClientActif(list[0]); setPret(true); }
      else if (list.length === 0) setPret(true);
      // Si > 1 : l'écran SélecteurClientSociete attend que l'utilisateur choisisse
    }).catch(() => setPret(true));
  }, []);

  return (
    <Ctx.Provider value={{ clients, clientActif, setClientActif: (c) => { setClientActif(c); setPret(true); }, pret }}>
      {children}
    </Ctx.Provider>
  );
}

export function useClientSociete() {
  return useContext(Ctx);
}

// Badge du client actif affiché dans le header du portail (petit rappel visuel)
export function BadgeClientActif() {
  const { clientActif, clients, setClientActif } = useClientSociete();
  if (clients.length <= 1 || !clientActif) return null;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground">Client :</span>
      <select
        value={clientActif.id}
        onChange={(e) => {
          const c = clients.find((x) => x.id === e.target.value);
          if (c) setClientActif(c);
        }}
        className="text-[11.5px] font-medium text-foreground bg-transparent border border-border rounded px-1.5 py-0.5 focus:outline-none"
      >
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.nom}</option>
        ))}
      </select>
    </div>
  );
}
