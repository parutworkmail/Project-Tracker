-- Make assignedById nullable so deleting the assigning user doesn't
-- block it (audit trail only, not a hard dependency), and switch the
-- delete behavior from RESTRICT to SET NULL.
ALTER TABLE "ProjectAdmin" DROP CONSTRAINT "ProjectAdmin_assignedById_fkey";
ALTER TABLE "ProjectAdmin" ALTER COLUMN "assignedById" DROP NOT NULL;
ALTER TABLE "ProjectAdmin"
  ADD CONSTRAINT "ProjectAdmin_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
