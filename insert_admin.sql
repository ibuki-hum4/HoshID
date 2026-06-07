INSERT INTO "user" (id, email, name, role, status, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@hoshid.local',
  'Administrator',
  'admin',
  'active',
  now(),
  now()
);
