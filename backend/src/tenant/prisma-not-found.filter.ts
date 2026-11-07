import { ArgumentsHost, Catch, HttpStatus } from "@nestjs/common";
import { BaseExceptionFilter } from "@nestjs/core";
import { Prisma } from "@prisma/client";

// Un update/delete scopé par société (voir prisma.service.ts) qui ne trouve
// aucune ligne — id inexistant OU appartenant à une autre société — lève
// P2025 chez Prisma. On le renvoie en 404 (jamais 500) pour ne pas révéler
// l'existence d'une ressource d'une autre société. Les services qui
// interceptent eux-mêmes P2025 ne sont pas concernés (le filtre ne reçoit que
// les erreurs non gérées).
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaNotFoundFilter extends BaseExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    if (exception.code === "P2025") {
      const res = host.switchToHttp().getResponse();
      res.status(HttpStatus.NOT_FOUND).json({
        statusCode: HttpStatus.NOT_FOUND,
        message: "Ressource introuvable.",
        error: "Not Found",
      });
      return;
    }
    super.catch(exception, host);
  }
}
