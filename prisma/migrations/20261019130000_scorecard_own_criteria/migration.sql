-- Each joinee scorecard keeps its own criteria; the company list becomes the default for new
-- cards. Additive, so the live build keeps working before the new code is deployed.
-- Hand-written; apply with `npx prisma migrate deploy`.

ALTER TABLE "joinee_scorecards" ADD COLUMN IF NOT EXISTS "criteria" JSONB;

-- Existing cards keep exactly what they show today: their company's list, or the built-in six.
UPDATE "joinee_scorecards" s
SET "criteria" = COALESCE(
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'key', c."key",
                'side', c."side",
                'label', c."label",
                'isActive', c."is_active"
            )
            ORDER BY c."display_order"
        )
        FROM "joinee_scorecard_criteria" c
        WHERE c."tenant_id" = s."tenant_id"
    ),
    '[
        {"key": "mgrJobRole", "side": "MANAGER", "label": "Understanding of Job Role", "isActive": true},
        {"key": "mgrCommunication", "side": "MANAGER", "label": "Communication & Ownership", "isActive": true},
        {"key": "mgrLearning", "side": "MANAGER", "label": "Learning / Collaboration Skills", "isActive": true},
        {"key": "hrDiscipline", "side": "HR", "label": "Discipline & Attendance", "isActive": true},
        {"key": "hrCulture", "side": "HR", "label": "Culture & Collaboration", "isActive": true},
        {"key": "hrLearning", "side": "HR", "label": "Learning / Adaptability", "isActive": true}
    ]'::jsonb
)
WHERE s."criteria" IS NULL;
