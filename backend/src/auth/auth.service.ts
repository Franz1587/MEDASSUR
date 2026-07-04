import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException("Identifiants invalides");
    }

    const payload = { sub: user.id, email: user.email, roleId: user.roleId };
    return {
      accessToken: await this.jwt.signAsync(payload),
      user: { id: user.id, nom: user.nom, email: user.email, roleId: user.roleId, initiales: user.initiales },
    };
  }
}
