-- Migration: 0052_news_feed.sql
-- Description: News feed with keyword tracking via NewsAPI.ai

-- News keywords table (project-level keyword tracking)
CREATE TABLE IF NOT EXISTS news_keywords (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  keyword VARCHAR(255) NOT NULL,
  source VARCHAR(50) NOT NULL DEFAULT 'manual',
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_keywords_project_keyword_unique UNIQUE (project_id, keyword)
);

-- News articles table (fetched articles, deduplicated by URL)
CREATE TABLE IF NOT EXISTS news_articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  description TEXT,
  source_name VARCHAR(255),
  author VARCHAR(255),
  url TEXT NOT NULL,
  image_url TEXT,
  published_at TIMESTAMPTZ,
  matched_keywords TEXT[] NOT NULL DEFAULT '{}',
  sentiment REAL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  is_starred BOOLEAN NOT NULL DEFAULT false,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_articles_project_url_unique UNIQUE (project_id, url)
);

-- News article entity links (articles linked to organizations)
CREATE TABLE IF NOT EXISTS news_article_entities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  article_id UUID NOT NULL REFERENCES news_articles(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  match_type VARCHAR(50) NOT NULL DEFAULT 'keyword',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT news_article_entities_article_org_unique UNIQUE (article_id, organization_id)
);

-- News fetch log (token tracking)
CREATE TABLE IF NOT EXISTS news_fetch_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  tokens_used INTEGER NOT NULL DEFAULT 1,
  articles_fetched INTEGER NOT NULL DEFAULT 0,
  keywords_searched TEXT[] NOT NULL DEFAULT '{}',
  error_message TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_news_keywords_project_active ON news_keywords(project_id, is_active);
CREATE INDEX IF NOT EXISTS idx_news_keywords_org ON news_keywords(organization_id) WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_news_articles_project_published ON news_articles(project_id, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_project_fetched ON news_articles(project_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_articles_starred ON news_articles(project_id) WHERE is_starred = true;
CREATE INDEX IF NOT EXISTS idx_news_article_entities_article ON news_article_entities(article_id);
CREATE INDEX IF NOT EXISTS idx_news_article_entities_org ON news_article_entities(organization_id);
CREATE INDEX IF NOT EXISTS idx_news_fetch_log_project ON news_fetch_log(project_id, fetched_at DESC);

-- RLS for news_keywords
ALTER TABLE news_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view news keywords in their projects"
  ON news_keywords FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = news_keywords.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Members can manage news keywords"
  ON news_keywords FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = news_keywords.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

-- RLS for news_articles
ALTER TABLE news_articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view news articles in their projects"
  ON news_articles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = news_articles.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update news articles in their projects"
  ON news_articles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = news_articles.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage news articles"
  ON news_articles FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for news_article_entities
ALTER TABLE news_article_entities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view news article entities in their projects"
  ON news_article_entities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM news_articles
      JOIN project_memberships ON project_memberships.project_id = news_articles.project_id
      WHERE news_articles.id = news_article_entities.article_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage news article entities"
  ON news_article_entities FOR ALL
  USING (auth.role() = 'service_role');

-- RLS for news_fetch_log
ALTER TABLE news_fetch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view news fetch log in their projects"
  ON news_fetch_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM project_memberships
      WHERE project_memberships.project_id = news_fetch_log.project_id
        AND project_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can manage news fetch log"
  ON news_fetch_log FOR ALL
  USING (auth.role() = 'service_role');

-- Updated_at trigger for news_keywords
CREATE TRIGGER update_news_keywords_updated_at
  BEFORE UPDATE ON news_keywords
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- RPC for upserting articles with keyword merge (SECURITY DEFINER for cron/service usage)
CREATE OR REPLACE FUNCTION upsert_news_article(
  p_project_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_description TEXT,
  p_source_name VARCHAR(255),
  p_author VARCHAR(255),
  p_url TEXT,
  p_image_url TEXT,
  p_published_at TIMESTAMPTZ,
  p_matched_keywords TEXT[],
  p_sentiment REAL DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_article_id UUID;
BEGIN
  INSERT INTO news_articles (
    project_id, title, body, description, source_name, author,
    url, image_url, published_at, matched_keywords, sentiment
  )
  VALUES (
    p_project_id, p_title, p_body, p_description, p_source_name, p_author,
    p_url, p_image_url, p_published_at, p_matched_keywords, p_sentiment
  )
  ON CONFLICT (project_id, url)
  DO UPDATE SET
    matched_keywords = ARRAY(
      SELECT DISTINCT unnest(news_articles.matched_keywords || EXCLUDED.matched_keywords)
    ),
    body = COALESCE(EXCLUDED.body, news_articles.body),
    description = COALESCE(EXCLUDED.description, news_articles.description)
  RETURNING id INTO v_article_id;

  RETURN v_article_id;
END;
$$;
