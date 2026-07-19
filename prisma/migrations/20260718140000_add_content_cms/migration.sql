-- CMS: editable storefront content.
-- Structured page content (About / Makers / Careers) as one JSON row per page,
-- plus the Journal (blog) post collection.

CREATE TABLE "content_pages" (
    "key" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("key")
);

CREATE TABLE "journal_posts" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT NOT NULL DEFAULT '',
    "body" TEXT NOT NULL DEFAULT '',
    "cover_image" TEXT,
    "category" TEXT NOT NULL DEFAULT '',
    "author" TEXT,
    "read_time" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "journal_posts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "journal_posts_slug_key" ON "journal_posts"("slug");
CREATE INDEX "journal_posts_published_published_at_idx" ON "journal_posts"("published", "published_at");

-- Seed the previously hard-coded journal posts so the page keeps its content and
-- admins have real posts to edit. Body defaults to the excerpt until enriched.
INSERT INTO "journal_posts"
  ("id", "slug", "title", "excerpt", "body", "cover_image", "category", "read_time", "published", "published_at", "updated_at")
VALUES
  (gen_random_uuid(), 'omolewa-shea-butter', 'Omolewa, on shea butter and slow rituals',
   'Three generations of women, one stainless-steel pot, and the recipe Omolewa won''t let us write down.',
   'Three generations of women, one stainless-steel pot, and the recipe Omolewa won''t let us write down.',
   'https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=1200&q=80&auto=format&fit=crop',
   'Maker', '8 min read', true, TIMESTAMPTZ '2026-05-01 09:00:00+01', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'aba-leather', 'Aba''s leather workshops, photographed for the first time',
   'A morning with the Ade-and-sons workshop on Faulks Road, where every Avmall tote starts its life.',
   'A morning with the Ade-and-sons workshop on Faulks Road, where every Avmall tote starts its life.',
   'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&q=80&auto=format&fit=crop',
   'Makers', '6 min read', true, TIMESTAMPTZ '2026-04-18 09:00:00+01', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'harmattan-pantry', 'The harmattan pantry: five staples for dry-season cooking',
   'Smoked dried fish, suya pepper, palm nut purée, ofada rice, and a kuli-kuli that''s changed our brunches.',
   'Smoked dried fish, suya pepper, palm nut purée, ofada rice, and a kuli-kuli that''s changed our brunches.',
   'https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=1200&q=80&auto=format&fit=crop',
   'Recipe', '5 min read', true, TIMESTAMPTZ '2026-03-30 09:00:00+01', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'iba-silk', 'Why Iba weaves with their hands, in a factory age',
   'A studio visit in Zaria with the silk-scarf weavers who''ve quietly become an Avmall bestseller.',
   'A studio visit in Zaria with the silk-scarf weavers who''ve quietly become an Avmall bestseller.',
   'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=1200&q=80&auto=format&fit=crop',
   'Maker', '9 min read', true, TIMESTAMPTZ '2026-03-12 09:00:00+01', CURRENT_TIMESTAMP);
