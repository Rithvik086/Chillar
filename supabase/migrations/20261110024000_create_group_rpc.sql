CREATE OR REPLACE FUNCTION public.create_group(
  p_name text,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING errcode = '28000';
  END IF;

  IF p_name IS NULL OR char_length(trim(p_name)) NOT BETWEEN 1 AND 60 THEN
    RAISE EXCEPTION 'Group name must contain 1-60 characters' USING errcode = '22023';
  END IF;

  IF p_description IS NOT NULL AND char_length(trim(p_description)) > 200 THEN
    RAISE EXCEPTION 'Group description cannot exceed 200 characters' USING errcode = '22023';
  END IF;

  INSERT INTO public.groups (name, description, currency, created_by)
  VALUES (trim(p_name), nullif(trim(p_description), ''), 'INR', auth.uid())
  RETURNING id INTO v_group_id;

  RETURN v_group_id;
END;
$$;

ALTER FUNCTION public.create_group(text, text) OWNER TO postgres;

REVOKE ALL ON FUNCTION public.create_group(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_group(text, text) TO authenticated;
