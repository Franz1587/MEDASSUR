import { useEffect, useState } from "react";
import photo01 from "@/assets/carousel/photo-01.png";
import photo02 from "@/assets/carousel/photo-02.png";
import photo03 from "@/assets/carousel/photo-03.png";
import photo04 from "@/assets/carousel/photo-04.png";
import photo05 from "@/assets/carousel/photo-05.png";

interface Slide {
  image: string;
  alt: string;
  position: string;
}

const slides: Slide[] = [
  {
    image: photo01,
    alt: "Consultation medicale couverte par assurance sante",
    position: "50% 38%",
  },
  {
    image: photo02,
    alt: "Famille africaine en clinique pour prise en charge sante",
    position: "50% 35%",
  },
  {
    image: photo03,
    alt: "Personnel soignant et patient a l hopital",
    position: "50% 46%",
  },
  {
    image: photo04,
    alt: "Admission et dossier assurance maladie",
    position: "50% 36%",
  },
  {
    image: photo05,
    alt: "Parcours de soins et couverture assurance sante",
    position: "50% 38%",
  },
];

const INTERVAL_MS = 3200;

export function ProfessionsCarousel() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  const current = slides[index];

  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-0 overflow-hidden">
        <img
          key={index}
          src={current.image}
          alt={current.alt}
          className="w-full h-full object-cover animate-[fadeIn_0.6s_ease,kenBurns_3.2s_ease-out]"
          style={{ objectPosition: current.position }}
          loading="eager"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#082b49]/52 via-transparent to-[#083a61]/38" />
      </div>
      <div className="absolute left-6 bottom-6 flex items-center gap-1.5 z-10">
        {slides.map((s, i) => (
          <button
            key={s.alt}
            onClick={() => setIndex(i)}
            aria-label={s.alt}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-7 bg-white" : "w-2 bg-white/45 hover:bg-white/70"}`}
          />
        ))}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @keyframes kenBurns {
          from { transform: scale(1.01); }
          to { transform: scale(1.035); }
        }
      `}</style>
    </div>
  );
}
