-- Free-text tags on a goal ("weekly", "primary", "q4 push").
--
-- Hand-written (migrate dev cannot create a shadow DB here - P3014), additive
-- only, and safe to apply while the previous build is serving: the column has
-- a default, so rows written by the old code stay valid.
--
-- TEXT[] rather than a join table or an enum. A tag here is a label a project
-- manager types, not a controlled vocabulary - there is nothing to hang off it,
-- no per-tag metadata to store, and the whole set for a project is a handful of
-- rows already in memory when the board renders. A join table would buy
-- normalisation nobody needs and cost a query on every read.
--
-- No index: the Goals tab filters on tags IN THE BROWSER, over the tree it has
-- already fetched, so nothing queries this column with a WHERE clause. An index
-- would be write cost for a read that never happens. Add a GIN index here the
-- day tag filtering moves server-side.
ALTER TABLE "project_goals"
    ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
