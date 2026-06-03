-- CreateEnum
CREATE TYPE "DealType" AS ENUM ('sale', 'jeonse', 'wolse');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('apartment', 'officetel', 'villa', 'house', 'commercial', 'land');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'contracted', 'hidden');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('north', 'east', 'south', 'west', 'northeast', 'southeast', 'southwest', 'northwest');

-- CreateTable
CREATE TABLE "InternalListing" (
    "id" SERIAL NOT NULL,
    "agencyId" INTEGER NOT NULL,
    "createdById" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "complexName" TEXT,
    "dong" TEXT,
    "ho" TEXT,
    "floor" TEXT,
    "direction" "Direction",
    "pyeongType" TEXT,
    "dealType" "DealType" NOT NULL,
    "propertyType" "PropertyType" NOT NULL,
    "salePrice" BIGINT,
    "deposit" BIGINT,
    "monthlyRent" BIGINT,
    "areaM2" DECIMAL(8,2) NOT NULL,
    "supplyAreaM2" DECIMAL(8,2),
    "address" TEXT NOT NULL,
    "roadAddress" TEXT,
    "addressDetail" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "maintenanceFee" INTEGER,
    "availableMoveInDate" TIMESTAMP(3),
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "ownerMemo" TEXT,
    "commissionRate" DECIMAL(4,2),
    "description" TEXT,
    "privateMemo" TEXT,
    "status" "ListingStatus" NOT NULL DEFAULT 'active',
    "contractedAt" TIMESTAMP(3),
    "contractedPrice" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingPhoto" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListingContract" (
    "id" SERIAL NOT NULL,
    "listingId" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingContract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InternalListing_agencyId_idx" ON "InternalListing"("agencyId");

-- CreateIndex
CREATE INDEX "InternalListing_createdById_idx" ON "InternalListing"("createdById");

-- CreateIndex
CREATE INDEX "InternalListing_status_idx" ON "InternalListing"("status");

-- CreateIndex
CREATE INDEX "ListingPhoto_listingId_idx" ON "ListingPhoto"("listingId");

-- CreateIndex
CREATE INDEX "ListingContract_listingId_idx" ON "ListingContract"("listingId");

-- AddForeignKey
ALTER TABLE "InternalListing" ADD CONSTRAINT "InternalListing_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InternalListing" ADD CONSTRAINT "InternalListing_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Agent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingPhoto" ADD CONSTRAINT "ListingPhoto_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "InternalListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListingContract" ADD CONSTRAINT "ListingContract_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "InternalListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
