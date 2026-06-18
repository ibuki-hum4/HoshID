-- AlterTable
ALTER TABLE "role" ADD COLUMN "is_protected" BOOLEAN NOT NULL DEFAULT false;

-- Seed the built-in "admin" role with the full permission bitmask (127) and
-- mark it protected so it can never be deleted or renamed away from existing
-- "admin" string checks (setup bootstrap, make-admin route, client isAdmin).
INSERT INTO "role" ("id", "name", "custom_id", "description", "permission_bitmask", "is_protected", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Admin',
  'admin',
  'Full administrative access to every workspace area.',
  127,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("custom_id") DO UPDATE SET
  "permission_bitmask" = 127,
  "is_protected" = true;

-- Seed the built-in "user" role (no administrative permissions by default).
-- Leave permission_bitmask untouched if the row already exists so any prior
-- manual customization survives; only enforce protection.
INSERT INTO "role" ("id", "name", "custom_id", "description", "permission_bitmask", "is_protected", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'Member',
  'user',
  'Standard member without administrative access.',
  0,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("custom_id") DO UPDATE SET
  "is_protected" = true;
