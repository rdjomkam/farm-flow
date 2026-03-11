-- BUG-001: email nullable + ajout phone pour login par telephone
-- Les pisciculteurs camerounais n'ont pas tous un email

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "phone" TEXT,
ALTER COLUMN "email" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
