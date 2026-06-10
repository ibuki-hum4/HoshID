import "server-only";

import { Prisma } from "@prisma/client";

export function isPrismaErrorCode(error: unknown, code: string): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === code
  );
}
