CREATE OR REPLACE FUNCTION public.replace_interview_calendar(_owner uuid, _username text, _slug text, _event_id integer, _timezone text, _encrypted_key text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE result uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtext(_owner::text));
 UPDATE public.interview_calendars SET enabled=false WHERE owner_id=_owner AND enabled;
 INSERT INTO public.interview_calendars(owner_id,username,event_slug,event_type_id,timezone,encrypted_api_key) VALUES(_owner,_username,_slug,_event_id,_timezone,_encrypted_key) RETURNING id INTO result;
 RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.replace_interview_calendar(uuid,text,text,integer,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.replace_interview_calendar(uuid,text,text,integer,text,text) TO service_role;