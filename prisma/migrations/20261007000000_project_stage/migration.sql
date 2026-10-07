-- Project "Phase": where the client's brand is in its lifecycle - Launch,
-- Growth, Rebranding, Decline. Optional; existing projects start unset.
-- A nullable column with no default is a catalog-only change in Postgres (no
-- table rewrite, no long lock). Hand-written; apply with `npx prisma migrate deploy`.
CREATE TYPE "ProjectStage" AS ENUM ('LAUNCH', 'GROWTH', 'REBRANDING', 'DECLINE');

ALTER TABLE "projects" ADD COLUMN "stage" "ProjectStage";
