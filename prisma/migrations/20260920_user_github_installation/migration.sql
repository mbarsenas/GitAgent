-- Add per-user GitHub App installation ownership
ALTER TABLE "User"
ADD COLUMN "githubInstallationId" TEXT;

ALTER TABLE "Repository"
ADD COLUMN "userId" TEXT;

CREATE UNIQUE INDEX "User_githubInstallationId_key"
ON "User"("githubInstallationId");

CREATE INDEX "Repository_userId_provider_idx"
ON "Repository"("userId", "provider");

ALTER TABLE "Repository"
ADD CONSTRAINT "Repository_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
