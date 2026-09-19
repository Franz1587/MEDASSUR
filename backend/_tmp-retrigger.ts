import { NestFactory } from "@nestjs/core";
import { AppModule } from "./src/app.module";
import { MessagerieAgentIaService } from "./src/messagerie/agent-ia.service";

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
  const agentIa = app.get(MessagerieAgentIaService);
  await agentIa.demarrerDemandeGarantie("cmt4yobuu0001l9klwh4l7mnd", {
    id: "PEC-2026-C6AE6B",
    type: "Optique",
    prestataire: "FASHION OPTIC",
  });
  console.log("Conversation redeclenchee avec la nouvelle logique.");
  await app.close();
}
main();
