CREATE OR REPLACE FUNCTION public.sync_profile_recruiting_name()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  old_default text;
  new_default text;
  suffix text;
BEGIN
  IF NEW.first_name IS DISTINCT FROM OLD.first_name OR NEW.last_name IS DISTINCT FROM OLD.last_name THEN
    suffix := '-' || substr(replace(NEW.id::text, '-', ''), 1, 6);
    old_default := coalesce(nullif(public.slugify_name(trim(coalesce(OLD.first_name, '') || ' ' || coalesce(OLD.last_name, ''))), ''), 'agent') || suffix;
    new_default := coalesce(nullif(public.slugify_name(trim(coalesce(NEW.first_name, '') || ' ' || coalesce(NEW.last_name, ''))), ''), 'agent') || suffix;
    IF NEW.recruiting_slug IS NOT DISTINCT FROM OLD.recruiting_slug
       AND (OLD.recruiting_slug IS NULL OR trim(OLD.recruiting_slug) = '' OR OLD.recruiting_slug = old_default) THEN
      -- Never take a customized slug belonging to another account.
      IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE recruiting_slug = new_default AND id <> NEW.id) THEN
        NEW.recruiting_slug := new_default;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_profile_recruiting_name() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_profile_recruiting_name() TO service_role;
CREATE TRIGGER profiles_zz_sync_recruiting_name
BEFORE UPDATE OF first_name, last_name ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_profile_recruiting_name();