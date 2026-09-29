ALTER TABLE public.applicants ADD COLUMN IF NOT EXISTS vsl_watched_at timestamptz;
CREATE OR REPLACE FUNCTION public.mark_vsl_watched_by_token(_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r public.applicants%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.applicants WHERE confirmation_token = _token;
  IF NOT FOUND THEN RETURN jsonb_build_object('matched', false); END IF;
  IF r.vsl_watched_at IS NULL THEN
    UPDATE public.applicants SET vsl_watched_at = now() WHERE id = r.id;
    INSERT INTO public.applicant_activities (applicant_id, event_type, summary)
      VALUES (r.id, 'vsl_watched', 'Watched the opportunity video');
  END IF;
  RETURN jsonb_build_object('matched', true);
END $$;
GRANT EXECUTE ON FUNCTION public.mark_vsl_watched_by_token(text) TO anon, authenticated;