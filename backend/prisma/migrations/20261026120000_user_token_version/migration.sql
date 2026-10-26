-- Versión de sesión: subirla invalida los JWT ya emitidos del usuario
ALTER TABLE "user" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
