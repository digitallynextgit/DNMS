-- Dynamic merge variables + two authoring modes.
--
-- Templates could only use {{name}} and {{email}}, and any other placeholder was
-- shipped to the subscriber as literal "{{plan}}". Recipients now carry an
-- arbitrary `fields` map, and the renderer blanks unknown variables instead of
-- leaking them - so a template never has to be kept in sync with the list.

CREATE TYPE "EmailBodyMode" AS ENUM ('RICH', 'HTML');

-- Existing templates were hand-written HTML, so they reopen in the HTML editor.
-- New ones default to the WYSIWYG.
ALTER TABLE "project_email_templates"
  ADD COLUMN "body_mode" "EmailBodyMode" NOT NULL DEFAULT 'RICH';
UPDATE "project_email_templates" SET "body_mode" = 'HTML';

ALTER TABLE "project_campaigns"
  ADD COLUMN "body_mode" "EmailBodyMode" NOT NULL DEFAULT 'RICH';
UPDATE "project_campaigns" SET "body_mode" = 'HTML';

-- Arbitrary per-recipient merge data. Nullable: most recipients have none.
ALTER TABLE "project_recipients" ADD COLUMN "fields" JSONB;
