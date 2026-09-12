-- AlterTable
ALTER TABLE "users" ADD COLUMN     "authUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_authUserId_key" ON "users"("authUserId");
