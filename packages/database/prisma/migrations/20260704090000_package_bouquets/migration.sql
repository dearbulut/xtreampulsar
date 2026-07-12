-- Package <-> Bouquet implicit many-to-many (Prisma "_BouquetToPackage").
-- A = Bouquet.id, B = Package.id (alfabetik). Mevcut paketler ilişkisiz başlar.
CREATE TABLE "_BouquetToPackage" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

CREATE UNIQUE INDEX "_BouquetToPackage_AB_unique" ON "_BouquetToPackage"("A", "B");
CREATE INDEX "_BouquetToPackage_B_index" ON "_BouquetToPackage"("B");

ALTER TABLE "_BouquetToPackage"
  ADD CONSTRAINT "_BouquetToPackage_A_fkey" FOREIGN KEY ("A")
  REFERENCES "bouquets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_BouquetToPackage"
  ADD CONSTRAINT "_BouquetToPackage_B_fkey" FOREIGN KEY ("B")
  REFERENCES "packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
