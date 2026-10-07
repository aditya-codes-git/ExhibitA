-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "exhibita";

-- CreateTable
CREATE TABLE "exhibita"."Merchant" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibita"."Order" (
    "id" UUID NOT NULL,
    "merchantId" UUID NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "status" VARCHAR(40) NOT NULL DEFAULT 'LOCAL_CREATED',
    "paypalOrderId" VARCHAR(64),
    "createRequestId" UUID NOT NULL,
    "captureRequestId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exhibita"."Capture" (
    "id" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "paypalCaptureId" VARCHAR(64) NOT NULL,
    "status" VARCHAR(40) NOT NULL,
    "amountMinor" INTEGER NOT NULL,
    "currency" VARCHAR(3) NOT NULL,
    "occurredAt" TIMESTAMPTZ(3) NOT NULL,
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Capture_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Order_paypalOrderId_key" ON "exhibita"."Order"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_createRequestId_key" ON "exhibita"."Order"("createRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_captureRequestId_key" ON "exhibita"."Order"("captureRequestId");

-- CreateIndex
CREATE INDEX "Order_merchantId_createdAt_idx" ON "exhibita"."Order"("merchantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Capture_paypalCaptureId_key" ON "exhibita"."Capture"("paypalCaptureId");

-- CreateIndex
CREATE INDEX "Capture_orderId_occurredAt_idx" ON "exhibita"."Capture"("orderId", "occurredAt");

-- AddForeignKey
ALTER TABLE "exhibita"."Order" ADD CONSTRAINT "Order_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "exhibita"."Merchant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exhibita"."Capture" ADD CONSTRAINT "Capture_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "exhibita"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backend-only schema. Browser roles receive no access; no permissive policies.
REVOKE ALL ON SCHEMA "exhibita" FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA "exhibita" FROM PUBLIC, anon, authenticated;
ALTER TABLE "exhibita"."Merchant" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exhibita"."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "exhibita"."Capture" ENABLE ROW LEVEL SECURITY;

-- The first payment increment supports positive USD amounts in minor units.
ALTER TABLE "exhibita"."Order" ADD CONSTRAINT "Order_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "exhibita"."Order" ADD CONSTRAINT "Order_currency_usd" CHECK ("currency" = 'USD');
ALTER TABLE "exhibita"."Capture" ADD CONSTRAINT "Capture_amount_positive" CHECK ("amountMinor" > 0);
ALTER TABLE "exhibita"."Capture" ADD CONSTRAINT "Capture_currency_usd" CHECK ("currency" = 'USD');
