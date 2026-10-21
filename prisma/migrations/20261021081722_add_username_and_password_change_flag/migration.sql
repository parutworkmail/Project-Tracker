-- AlterTable: email becomes optional (nullable), no longer the login identifier
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable: add new columns
ALTER TABLE "User" ADD COLUMN "username" TEXT;
ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT true;

-- Backfill username for existing rows (dev DB, 3 known rows) before enforcing NOT NULL/UNIQUE
UPDATE "User" SET "username" = 'admin' WHERE "id" = 'cmvhtqqa8000034lcf5co261w';
UPDATE "User" SET "username" = 'test1' WHERE "id" = 'cmvgflid30000c0lcm7wtwxwo';
UPDATE "User" SET "username" = 'e2e-test' WHERE "id" = 'cmvgehxx20000j4lcs61c1hot';

-- Fallback for any other pre-existing rows not covered above: derive from email local-part
UPDATE "User" SET "username" = split_part("email", '@', 1) WHERE "username" IS NULL AND "email" IS NOT NULL;

-- Enforce NOT NULL + UNIQUE now that every row has a value
ALTER TABLE "User" ALTER COLUMN "username" SET NOT NULL;
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- Pre-existing rows set their own password via the old self-service signup
-- flow (not an admin-assigned temp password), so they don't need to be
-- forced through the new first-login password-change flow.
UPDATE "User" SET "mustChangePassword" = false WHERE "password" IS NOT NULL;

