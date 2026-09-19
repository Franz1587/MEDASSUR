import { createRoot } from "react-dom/client";
import App from "./app/App.tsx";
import { ThemeProvider } from "./app/providers/ThemeProvider.tsx";
import { Toaster } from "./app/components/ui/sonner.tsx";
import { AuthProvider } from "./auth/AuthContext.tsx";
import { PdfViewerHost } from "./components/shared/PdfViewerHost.tsx";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <AuthProvider>
      <App />
      <Toaster richColors position="top-right" />
      <PdfViewerHost />
    </AuthProvider>
  </ThemeProvider>,
);
