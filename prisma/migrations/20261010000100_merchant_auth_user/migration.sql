ALTER TABLE "exhibita"."Merchant" ADD COLUMN IF NOT EXISTS "authUserId" UUID;
CREATE UNIQUE INDEX IF NOT EXISTS "Merchant_authUserId_key" ON "exhibita"."Merchant"("authUserId");
