
-- DropIndex
DROP INDEX "LotAlevins_code_key";

-- CreateIndex
CREATE UNIQUE INDEX "LotAlevins_siteId_code_key" ON "LotAlevins"("siteId", "code");

