import { useRef, useState } from "react";
import { Upload } from "lucide-react";

export function UploadDropzone({
  onFiles, label, hint, accept,
}: { onFiles: (files: File[]) => void; label: string; hint: string; accept?: string }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) onFiles(files);
      }}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-primary/3"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length > 0) onFiles(files);
          e.target.value = "";
        }}
      />
      <div className="flex flex-col items-center gap-3">
        <div className="p-4 bg-primary/10 rounded-full border border-primary/20">
          <Upload className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-foreground font-semibold mb-1">{label}</p>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity mt-1"
        >
          Parcourir les fichiers
        </button>
      </div>
    </div>
  );
}
