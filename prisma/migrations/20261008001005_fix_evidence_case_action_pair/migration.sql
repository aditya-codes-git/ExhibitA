ALTER TABLE "exhibita"."EvidenceCase" DROP CONSTRAINT "EvidenceCase_action_pair";

ALTER TABLE "exhibita"."EvidenceCase" ADD CONSTRAINT "EvidenceCase_action_pair" CHECK (
    ("agentActionSource" IS NULL AND "agentActionAt" IS NULL)
    OR ("agentActionSource" IS NOT NULL AND "agentActionSource" = 'SIMULATED_DEMO' AND "agentActionAt" IS NOT NULL)
);
