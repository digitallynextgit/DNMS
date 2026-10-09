-- Section A is now titled "Role Performance (KPI)"; evaluations store their label, so rename it there
-- too. Hand-written; apply with `npx prisma migrate deploy`.
UPDATE "evaluations"
SET "section_a_label" = 'Role Performance (KPI)'
WHERE "section_a_label" = 'Role Performance (KRA & KPI)';
