import { IsBoolean } from "class-validator";

export class SuspendreAssureDto {
  @IsBoolean()
  suspendre: boolean;
}
