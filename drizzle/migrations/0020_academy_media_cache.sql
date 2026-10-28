CREATE TABLE public.academy_media_cache (
  source_url text PRIMARY KEY,
  storage_path text,
  content_type text,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.academy_media_cache TO service_role;
ALTER TABLE public.academy_media_cache ENABLE ROW LEVEL SECURITY;