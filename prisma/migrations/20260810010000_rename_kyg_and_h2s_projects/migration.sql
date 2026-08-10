-- Two clients go by their full names now: KYG is KNOW YOUR GENES and H2S is
-- HARD2SOFT. Keyed on the project code, which is the stable identifier - the
-- name is what people read, the code is what the sheets and seeds match on.
--
-- The slug is left alone on purpose (see Project.slug in schema.prisma): a URL
-- that moves silently breaks every link already shared.
UPDATE "projects" SET "name" = 'KNOW YOUR GENES' WHERE "code" = 'DN00007';
UPDATE "projects" SET "name" = 'HARD2SOFT' WHERE "code" = 'DN00006';
