-- CreateTable
CREATE TABLE "exhibita"."EvidenceCase" (
    "orderId" UUID NOT NULL,
    "buyerInstruction" TEXT NOT NULL,
    "itemName" VARCHAR(200) NOT NULL,
    "shopName" VARCHAR(200) NOT NULL,
    "agentActionSource" VARCHAR(40),
    "agentActionAt" TIMESTAMPTZ(3),
    "recordedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceCase_pkey" PRIMARY KEY ("orderId")
);

-- AddForeignKey
ALTER TABLE "exhibita"."EvidenceCase" ADD CONSTRAINT "EvidenceCase_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "exhibita"."Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Match the private, backend-only access model of the existing tables.
REVOKE ALL ON TABLE "exhibita"."EvidenceCase" FROM PUBLIC, anon, authenticated;
ALTER TABLE "exhibita"."EvidenceCase" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "exhibita"."EvidenceCase" ADD CONSTRAINT "EvidenceCase_action_pair" CHECK (
    ("agentActionSource" IS NULL AND "agentActionAt" IS NULL)
    OR ("agentActionSource" = 'SIMULATED_DEMO' AND "agentActionAt" IS NOT NULL)
);
