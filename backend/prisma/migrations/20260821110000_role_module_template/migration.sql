CREATE TABLE "RoleModuleTemplate" (
    "roleId" TEXT NOT NULL,
    "modules" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "RoleModuleTemplate_pkey" PRIMARY KEY ("roleId")
);
