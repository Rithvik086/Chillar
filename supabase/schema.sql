


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."accept_group_invite"("p_token_hash" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_invite public.group_invites%rowtype;
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;

  select * into v_invite
  from public.group_invites
  where token_hash = p_token_hash
  for update;

  if not found
     or v_invite.revoked_at is not null
     or v_invite.expires_at <= now()
     or (v_invite.max_uses is not null and v_invite.uses_count >= v_invite.max_uses) then
    raise exception 'Invitation is invalid, expired, revoked, or fully used'
      using errcode = '22023';
  end if;

  perform 1 from public.groups where id = v_invite.group_id for update;

  select count(*) into v_active_count
  from public.group_members
  where group_id = v_invite.group_id and status = 'active';

  if v_active_count >= 20 then
    raise exception 'This group has reached the maximum of 20 active members'
      using errcode = '23514';
  end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (v_invite.group_id, auth.uid(), 'member', 'active')
  on conflict (group_id, user_id)
  do update set status = 'active', role = 'member', joined_at = now();

  update public.group_invites
  set uses_count = uses_count + 1
  where id = v_invite.id;

  return v_invite.group_id;
end;
$$;


ALTER FUNCTION "public"."accept_group_invite"("p_token_hash" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."add_group_creator_as_admin"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.group_members (group_id, user_id, role, status)
  values (new.id, new.created_by, 'admin', 'active');
  return new;
end;
$$;


ALTER FUNCTION "public"."add_group_creator_as_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_manage_expense"("p_expense_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.expenses e
    where e.id = p_expense_id
      and (
        e.created_by = p_user_id
        or public.is_group_admin(e.group_id, p_user_id)
      )
  );
$$;


ALTER FUNCTION "public"."can_manage_expense"("p_expense_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."can_view_profile"("p_profile_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select p_profile_id = auth.uid()
    or exists (
      select 1
      from public.group_members mine
      join public.group_members theirs
        on theirs.group_id = mine.group_id
       and theirs.user_id = p_profile_id
       and theirs.status = 'active'
      where mine.user_id = auth.uid()
        and mine.status = 'active'
    );
$$;


ALTER FUNCTION "public"."can_view_profile"("p_profile_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_expense"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT public.create_expense_multi(
    p_group_id,
    p_description,
    p_amount_paise,
    jsonb_build_array(
      jsonb_build_object(
        'user_id', p_paid_by,
        'amount_paid_paise', p_amount_paise
      )
    ),
    p_split_type,
    p_splits,
    p_notes
  );
$$;


ALTER FUNCTION "public"."create_expense"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_expense_multi"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_expense_id uuid;
  v_payer_total numeric;
  v_payer_count integer;
  v_split_total numeric;
  v_split_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING errcode = '28000';
  END IF;

  IF NOT public.is_active_group_member(p_group_id, auth.uid()) THEN
    RAISE EXCEPTION 'You are not an active member of this group'
      USING errcode = '42501';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Expense amount must be positive'
      USING errcode = '22023';
  END IF;

  IF p_description IS NULL
     OR char_length(trim(p_description)) NOT BETWEEN 1 AND 140 THEN
    RAISE EXCEPTION 'Description must contain 1-140 characters'
      USING errcode = '22023';
  END IF;

  IF p_split_type NOT IN ('equal', 'exact', 'percentage', 'shares') THEN
    RAISE EXCEPTION 'Invalid split type'
      USING errcode = '22023';
  END IF;

  IF p_notes IS NOT NULL AND char_length(p_notes) > 2000 THEN
    RAISE EXCEPTION 'Notes cannot exceed 2000 characters'
      USING errcode = '22023';
  END IF;

  -- Validate payer JSON structure.
  IF p_payers IS NULL OR jsonb_typeof(p_payers) <> 'array' THEN
    RAISE EXCEPTION 'Payers must be a JSON array'
      USING errcode = '22023';
  END IF;

  IF jsonb_array_length(p_payers) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'An expense requires 1-20 payers'
      USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payers) x
    WHERE coalesce(x ->> 'user_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR coalesce(x ->> 'amount_paid_paise', '')
        !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION 'Each payer requires a valid user ID and positive integer contribution'
      USING errcode = '22023';
  END IF;

  SELECT count(*),
         coalesce(sum((x ->> 'amount_paid_paise')::numeric), 0)
  INTO v_payer_count, v_payer_total
  FROM jsonb_array_elements(p_payers) x;

  IF v_payer_total <> p_amount_paise THEN
    RAISE EXCEPTION 'Payer contributions must equal the expense amount'
      USING errcode = '23514';
  END IF;

  IF (
    SELECT count(DISTINCT (x ->> 'user_id'))
    FROM jsonb_array_elements(p_payers) x
  ) <> v_payer_count THEN
    RAISE EXCEPTION 'Duplicate payers are not allowed'
      USING errcode = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payers) x
    WHERE NOT public.is_active_group_member(
      p_group_id,
      (x ->> 'user_id')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Every payer must be an active group member'
      USING errcode = '23514';
  END IF;

  -- Validate split JSON structure.
  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array' THEN
    RAISE EXCEPTION 'Splits must be a JSON array'
      USING errcode = '22023';
  END IF;

  IF jsonb_array_length(p_splits) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'An expense requires 1-20 participants'
      USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) x
    WHERE coalesce(x ->> 'user_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR coalesce(x ->> 'share_amount_paise', '')
        !~ '^(0|[1-9][0-9]*)$'
  ) THEN
    RAISE EXCEPTION 'Each split requires a valid user ID and non-negative integer share'
      USING errcode = '22023';
  END IF;

  SELECT count(*),
         coalesce(sum((x ->> 'share_amount_paise')::numeric), 0)
  INTO v_split_count, v_split_total
  FROM jsonb_array_elements(p_splits) x;

  IF v_split_total <> p_amount_paise THEN
    RAISE EXCEPTION 'Split shares must equal the expense amount'
      USING errcode = '23514';
  END IF;

  IF (
    SELECT count(DISTINCT (x ->> 'user_id'))
    FROM jsonb_array_elements(p_splits) x
  ) <> v_split_count THEN
    RAISE EXCEPTION 'Duplicate split participants are not allowed'
      USING errcode = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) x
    WHERE NOT public.is_active_group_member(
      p_group_id,
      (x ->> 'user_id')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Every split participant must be an active group member'
      USING errcode = '23514';
  END IF;

  -- Legacy paid_by stores the first payer.
  INSERT INTO public.expenses (
    group_id,
    description,
    amount_paise,
    paid_by,
    created_by,
    split_type,
    notes
  )
  VALUES (
    p_group_id,
    trim(p_description),
    p_amount_paise,
    (p_payers -> 0 ->> 'user_id')::uuid,
    auth.uid(),
    p_split_type,
    p_notes
  )
  RETURNING id INTO v_expense_id;

  INSERT INTO public.expense_payers (
    expense_id, user_id, amount_paid_paise
  )
  SELECT
    v_expense_id,
    (x ->> 'user_id')::uuid,
    (x ->> 'amount_paid_paise')::bigint
  FROM jsonb_array_elements(p_payers) x;

  INSERT INTO public.expense_splits (
    expense_id, user_id, share_amount_paise
  )
  SELECT
    v_expense_id,
    (x ->> 'user_id')::uuid,
    (x ->> 'share_amount_paise')::bigint
  FROM jsonb_array_elements(p_splits) x;

  RETURN v_expense_id;
END;
$_$;


ALTER FUNCTION "public"."create_expense_multi"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_group_member_limit"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
declare
  v_count integer;
begin
  if new.status = 'active' and
     (tg_op = 'INSERT' or old.status is distinct from 'active') then
    perform 1 from public.groups where id = new.group_id for update;

    select count(*) into v_count
    from public.group_members
    where group_id = new.group_id
      and status = 'active'
      and (tg_op = 'INSERT' or id <> new.id);

    if v_count >= 20 then
      raise exception 'This group has reached the maximum of 20 active members'
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_group_member_limit"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_name text;
  v_avatar_url text;
BEGIN
  v_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(coalesce(new.email, new.phone, 'Chillar user'), '@', 1), ''),
    'Chillar user'
  );

  v_avatar_url := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'picture'), '')
  );

  INSERT INTO public.profiles (id, full_name, avatar_url, phone)
  VALUES (new.id, v_name, v_avatar_url, new.phone)
  ON CONFLICT (id) DO NOTHING;

  RETURN new;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_active_group_member"("p_group_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.status = 'active'
  );
$$;


ALTER FUNCTION "public"."is_active_group_member"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = p_group_id
      and gm.user_id = p_user_id
      and gm.status = 'active'
      and gm.role = 'admin'
  );
$$;


ALTER FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_expense_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if tg_op = 'INSERT' then
    insert into public.activity_events (group_id, actor_id, event_type, entity_id, metadata)
    values (new.group_id, new.created_by, 'expense_created', new.id,
      jsonb_build_object('description', new.description, 'amount_paise', new.amount_paise));
    return new;
  elsif tg_op = 'UPDATE' then
    if old.voided_at is null and new.voided_at is not null then
      insert into public.activity_events (group_id, actor_id, event_type, entity_id, metadata)
      values (new.group_id, new.voided_by, 'expense_voided', new.id,
        jsonb_build_object('description', new.description, 'amount_paise', new.amount_paise));
    else
      insert into public.activity_events (group_id, actor_id, event_type, entity_id, metadata)
      values (new.group_id, auth.uid(), 'expense_updated', new.id,
        jsonb_build_object('description', new.description, 'amount_paise', new.amount_paise));
    end if;
    return new;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."log_expense_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_payment_activity"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_type text;
begin
  if tg_op = 'INSERT' then
    v_type := 'payment_recorded';
  elsif new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    v_type := 'payment_confirmed';
  elsif new.status = 'rejected' and old.status is distinct from 'rejected' then
    v_type := 'payment_rejected';
  else
    return new;
  end if;

  insert into public.activity_events (group_id, actor_id, event_type, entity_id, metadata)
  values (
    new.group_id,
    case when tg_op = 'INSERT' then new.created_by else auth.uid() end,
    v_type,
    new.id,
    jsonb_build_object('amount_paise', new.amount_paise, 'from_user_id', new.from_user_id, 'to_user_id', new.to_user_id)
  );

  return new;
end;
$$;


ALTER FUNCTION "public"."log_payment_activity"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
  tbl name;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        SELECT c.relname INTO tbl FROM pg_catalog.pg_class c WHERE c.oid = cmd.objid;
        EXECUTE format('alter table if exists %I.%I enable row level security', cmd.schema_name, tbl);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_payment_confirmed_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  if new.status = 'confirmed' and old.status is distinct from 'confirmed' then
    new.confirmed_at := now();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_payment_confirmed_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expense"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
  SELECT public.update_expense_multi(
    p_expense_id,
    p_description,
    p_amount_paise,
    jsonb_build_array(
      jsonb_build_object(
        'user_id', p_paid_by,
        'amount_paid_paise', p_amount_paise
      )
    ),
    p_split_type,
    p_splits,
    p_notes
  );
$$;


ALTER FUNCTION "public"."update_expense"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_expense_multi"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text" DEFAULT NULL::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $_$
DECLARE
  v_group_id uuid;
  v_payer_total numeric;
  v_payer_count integer;
  v_split_total numeric;
  v_split_count integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING errcode = '28000';
  END IF;

  SELECT group_id INTO v_group_id
  FROM public.expenses
  WHERE id = p_expense_id
    AND voided_at IS NULL
  FOR UPDATE;

  IF v_group_id IS NULL THEN
    RAISE EXCEPTION 'Expense not found or already voided'
      USING errcode = 'P0002';
  END IF;

  IF NOT public.can_manage_expense(p_expense_id, auth.uid()) THEN
    RAISE EXCEPTION 'Only the expense creator or a group admin can edit this expense'
      USING errcode = '42501';
  END IF;

  IF p_amount_paise IS NULL OR p_amount_paise <= 0
     OR p_description IS NULL
     OR char_length(trim(p_description)) NOT BETWEEN 1 AND 140
     OR p_split_type NOT IN ('equal', 'exact', 'percentage', 'shares')
     OR (p_notes IS NOT NULL AND char_length(p_notes) > 2000) THEN
    RAISE EXCEPTION 'Invalid expense details'
      USING errcode = '22023';
  END IF;

  IF p_payers IS NULL OR jsonb_typeof(p_payers) <> 'array'
     OR jsonb_array_length(p_payers) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Payers must contain 1-20 entries'
      USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payers) x
    WHERE coalesce(x ->> 'user_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR coalesce(x ->> 'amount_paid_paise', '')
        !~ '^[1-9][0-9]*$'
  ) THEN
    RAISE EXCEPTION 'Each payer requires a valid user ID and positive contribution'
      USING errcode = '22023';
  END IF;

  SELECT count(*),
         coalesce(sum((x ->> 'amount_paid_paise')::numeric), 0)
  INTO v_payer_count, v_payer_total
  FROM jsonb_array_elements(p_payers) x;

  IF v_payer_total <> p_amount_paise THEN
    RAISE EXCEPTION 'Payer contributions must equal the expense amount'
      USING errcode = '23514';
  END IF;

  IF (
    SELECT count(DISTINCT (x ->> 'user_id'))
    FROM jsonb_array_elements(p_payers) x
  ) <> v_payer_count THEN
    RAISE EXCEPTION 'Duplicate payers are not allowed'
      USING errcode = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_payers) x
    WHERE NOT public.is_active_group_member(
      v_group_id, (x ->> 'user_id')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Every payer must be an active group member'
      USING errcode = '23514';
  END IF;

  IF p_splits IS NULL OR jsonb_typeof(p_splits) <> 'array'
     OR jsonb_array_length(p_splits) NOT BETWEEN 1 AND 20 THEN
    RAISE EXCEPTION 'Splits must contain 1-20 entries'
      USING errcode = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) x
    WHERE coalesce(x ->> 'user_id', '')
        !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       OR coalesce(x ->> 'share_amount_paise', '')
        !~ '^(0|[1-9][0-9]*)$'
  ) THEN
    RAISE EXCEPTION 'Invalid split participant or share'
      USING errcode = '22023';
  END IF;

  SELECT count(*),
         coalesce(sum((x ->> 'share_amount_paise')::numeric), 0)
  INTO v_split_count, v_split_total
  FROM jsonb_array_elements(p_splits) x;

  IF v_split_total <> p_amount_paise THEN
    RAISE EXCEPTION 'Split shares must equal the expense amount'
      USING errcode = '23514';
  END IF;

  IF (
    SELECT count(DISTINCT (x ->> 'user_id'))
    FROM jsonb_array_elements(p_splits) x
  ) <> v_split_count THEN
    RAISE EXCEPTION 'Duplicate split participants are not allowed'
      USING errcode = '23505';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_splits) x
    WHERE NOT public.is_active_group_member(
      v_group_id, (x ->> 'user_id')::uuid
    )
  ) THEN
    RAISE EXCEPTION 'Every split participant must be an active group member'
      USING errcode = '23514';
  END IF;

  UPDATE public.expenses
  SET description = trim(p_description),
      amount_paise = p_amount_paise,
      paid_by = (p_payers -> 0 ->> 'user_id')::uuid,
      split_type = p_split_type,
      notes = p_notes
  WHERE id = p_expense_id;

  DELETE FROM public.expense_payers
  WHERE expense_id = p_expense_id;

  INSERT INTO public.expense_payers (
    expense_id, user_id, amount_paid_paise
  )
  SELECT
    p_expense_id,
    (x ->> 'user_id')::uuid,
    (x ->> 'amount_paid_paise')::bigint
  FROM jsonb_array_elements(p_payers) x;

  DELETE FROM public.expense_splits
  WHERE expense_id = p_expense_id;

  INSERT INTO public.expense_splits (
    expense_id, user_id, share_amount_paise
  )
  SELECT
    p_expense_id,
    (x ->> 'user_id')::uuid,
    (x ->> 'share_amount_paise')::bigint
  FROM jsonb_array_elements(p_splits) x;
END;
$_$;


ALTER FUNCTION "public"."update_expense_multi"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."void_expense"("p_expense_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if not public.can_manage_expense(p_expense_id, auth.uid()) then
    raise exception 'Only the expense creator or a group admin can void this expense'
      using errcode = '42501';
  end if;

  update public.expenses
  set voided_at = now(), voided_by = auth.uid()
  where id = p_expense_id
    and voided_at is null;

  if not found then
    raise exception 'Expense not found or already voided' using errcode = 'P0002';
  end if;
end;
$$;


ALTER FUNCTION "public"."void_expense"("p_expense_id" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."activity_events" (
    "id" bigint NOT NULL,
    "group_id" "uuid" NOT NULL,
    "actor_id" "uuid",
    "event_type" "text" NOT NULL,
    "entity_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "activity_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['group_created'::"text", 'member_joined'::"text", 'member_left'::"text", 'member_removed'::"text", 'expense_created'::"text", 'expense_updated'::"text", 'expense_voided'::"text", 'payment_recorded'::"text", 'payment_confirmed'::"text", 'payment_rejected'::"text"])))
);


ALTER TABLE "public"."activity_events" OWNER TO "postgres";


ALTER TABLE "public"."activity_events" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."activity_events_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."expense_payers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_paid_paise" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expense_payers_amount_paid_paise_check" CHECK (("amount_paid_paise" > 0))
);


ALTER TABLE "public"."expense_payers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_splits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "expense_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "share_amount_paise" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expense_splits_share_amount_paise_check" CHECK (("share_amount_paise" >= 0))
);


ALTER TABLE "public"."expense_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expenses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "amount_paise" bigint NOT NULL,
    "currency" character(3) DEFAULT 'INR'::"bpchar" NOT NULL,
    "paid_by" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "split_type" "text" NOT NULL,
    "notes" "text",
    "receipt_path" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "voided_at" timestamp with time zone,
    "voided_by" "uuid",
    CONSTRAINT "expenses_amount_paise_check" CHECK (("amount_paise" > 0)),
    CONSTRAINT "expenses_currency_check" CHECK (("currency" = 'INR'::"bpchar")),
    CONSTRAINT "expenses_description_check" CHECK ((("char_length"(TRIM(BOTH FROM "description")) >= 1) AND ("char_length"(TRIM(BOTH FROM "description")) <= 140))),
    CONSTRAINT "expenses_notes_check" CHECK ((("notes" IS NULL) OR ("char_length"("notes") <= 2000))),
    CONSTRAINT "expenses_split_type_check" CHECK (("split_type" = ANY (ARRAY['equal'::"text", 'exact'::"text", 'percentage'::"text", 'shares'::"text"])))
);


ALTER TABLE "public"."expenses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_invites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "expires_at" timestamp with time zone NOT NULL,
    "max_uses" integer,
    "uses_count" integer DEFAULT 0 NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_invites_max_uses_check" CHECK ((("max_uses" IS NULL) OR ("max_uses" > 0))),
    CONSTRAINT "group_invites_uses_count_check" CHECK (("uses_count" >= 0))
);


ALTER TABLE "public"."group_invites" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."group_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "group_members_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'member'::"text"]))),
    CONSTRAINT "group_members_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'left'::"text", 'removed'::"text"])))
);


ALTER TABLE "public"."group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "currency" character(3) DEFAULT 'INR'::"bpchar" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "groups_currency_check" CHECK (("currency" = 'INR'::"bpchar")),
    CONSTRAINT "groups_description_check" CHECK ((("description" IS NULL) OR ("char_length"("description") <= 500))),
    CONSTRAINT "groups_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "name")) <= 80)))
);


ALTER TABLE "public"."groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."payments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "amount_paise" bigint NOT NULL,
    "currency" character(3) DEFAULT 'INR'::"bpchar" NOT NULL,
    "method" "text" DEFAULT 'other'::"text" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "note" "text",
    "created_by" "uuid" NOT NULL,
    "confirmed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "payments_amount_paise_check" CHECK (("amount_paise" > 0)),
    CONSTRAINT "payments_check" CHECK (("from_user_id" <> "to_user_id")),
    CONSTRAINT "payments_currency_check" CHECK (("currency" = 'INR'::"bpchar")),
    CONSTRAINT "payments_method_check" CHECK (("method" = ANY (ARRAY['upi'::"text", 'cash'::"text", 'bank'::"text", 'other'::"text"]))),
    CONSTRAINT "payments_note_check" CHECK ((("note" IS NULL) OR ("char_length"("note") <= 500))),
    CONSTRAINT "payments_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'confirmed'::"text", 'rejected'::"text", 'cancelled'::"text"])))
);


ALTER TABLE "public"."payments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text" NOT NULL,
    "avatar_url" "text",
    "phone" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "profiles_full_name_check" CHECK ((("char_length"(TRIM(BOTH FROM "full_name")) >= 1) AND ("char_length"(TRIM(BOTH FROM "full_name")) <= 80)))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_payers"
    ADD CONSTRAINT "expense_payers_expense_user_key" UNIQUE ("expense_id", "user_id");



ALTER TABLE ONLY "public"."expense_payers"
    ADD CONSTRAINT "expense_payers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_expense_id_user_id_key" UNIQUE ("expense_id", "user_id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_user_id_key" UNIQUE ("group_id", "user_id");



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



CREATE INDEX "activity_events_group_created_idx" ON "public"."activity_events" USING "btree" ("group_id", "created_at" DESC, "id" DESC);



CREATE INDEX "expense_payers_user_id_idx" ON "public"."expense_payers" USING "btree" ("user_id");



CREATE INDEX "expense_splits_user_idx" ON "public"."expense_splits" USING "btree" ("user_id", "expense_id");



CREATE INDEX "expenses_created_by_idx" ON "public"."expenses" USING "btree" ("created_by");



CREATE INDEX "expenses_group_created_idx" ON "public"."expenses" USING "btree" ("group_id", "created_at" DESC) WHERE ("voided_at" IS NULL);



CREATE INDEX "expenses_paid_by_idx" ON "public"."expenses" USING "btree" ("paid_by");



CREATE INDEX "group_invites_group_idx" ON "public"."group_invites" USING "btree" ("group_id");



CREATE INDEX "group_members_group_status_idx" ON "public"."group_members" USING "btree" ("group_id", "status");



CREATE INDEX "group_members_user_status_idx" ON "public"."group_members" USING "btree" ("user_id", "status", "group_id");



CREATE INDEX "payments_from_user_idx" ON "public"."payments" USING "btree" ("from_user_id", "status");



CREATE INDEX "payments_group_created_idx" ON "public"."payments" USING "btree" ("group_id", "created_at" DESC);



CREATE INDEX "payments_to_user_idx" ON "public"."payments" USING "btree" ("to_user_id", "status");



CREATE UNIQUE INDEX "profiles_phone_unique" ON "public"."profiles" USING "btree" ("phone") WHERE ("phone" IS NOT NULL);



CREATE OR REPLACE TRIGGER "expenses_activity" AFTER INSERT OR UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."log_expense_activity"();



CREATE OR REPLACE TRIGGER "expenses_set_updated_at" BEFORE UPDATE ON "public"."expenses" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "group_members_limit" BEFORE INSERT OR UPDATE OF "status" ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_group_member_limit"();



CREATE OR REPLACE TRIGGER "group_members_set_updated_at" BEFORE UPDATE ON "public"."group_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "groups_add_creator" AFTER INSERT ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."add_group_creator_as_admin"();



CREATE OR REPLACE TRIGGER "groups_set_updated_at" BEFORE UPDATE ON "public"."groups" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "payments_activity" AFTER INSERT OR UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."log_payment_activity"();



CREATE OR REPLACE TRIGGER "payments_set_confirmed_at" BEFORE UPDATE OF "status" ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_payment_confirmed_at"();



CREATE OR REPLACE TRIGGER "payments_set_updated_at" BEFORE UPDATE ON "public"."payments" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "profiles_set_updated_at" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_events"
    ADD CONSTRAINT "activity_events_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_payers"
    ADD CONSTRAINT "expense_payers_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_payers"
    ADD CONSTRAINT "expense_payers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."expenses"
    ADD CONSTRAINT "expenses_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."group_invites"
    ADD CONSTRAINT "group_invites_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."group_members"
    ADD CONSTRAINT "group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."groups"
    ADD CONSTRAINT "groups_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."payments"
    ADD CONSTRAINT "payments_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."profiles"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."activity_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "activity_events_select_member" ON "public"."activity_events" FOR SELECT TO "authenticated" USING ("public"."is_active_group_member"("group_id"));



ALTER TABLE "public"."expense_payers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_payers_select_member" ON "public"."expense_payers" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."expenses" "e"
  WHERE (("e"."id" = "expense_payers"."expense_id") AND "public"."is_active_group_member"("e"."group_id", "auth"."uid"())))));



ALTER TABLE "public"."expense_splits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_splits_delete_manager" ON "public"."expense_splits" FOR DELETE TO "authenticated" USING ("public"."can_manage_expense"("expense_id"));



CREATE POLICY "expense_splits_insert_manager" ON "public"."expense_splits" FOR INSERT TO "authenticated" WITH CHECK ("public"."can_manage_expense"("expense_id"));



CREATE POLICY "expense_splits_select_member" ON "public"."expense_splits" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."expenses" "e"
  WHERE (("e"."id" = "expense_splits"."expense_id") AND "public"."is_active_group_member"("e"."group_id")))));



CREATE POLICY "expense_splits_update_manager" ON "public"."expense_splits" FOR UPDATE TO "authenticated" USING ("public"."can_manage_expense"("expense_id")) WITH CHECK ("public"."can_manage_expense"("expense_id"));



ALTER TABLE "public"."expenses" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expenses_insert_member" ON "public"."expenses" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."is_active_group_member"("group_id") AND "public"."is_active_group_member"("group_id", "paid_by")));



CREATE POLICY "expenses_select_member" ON "public"."expenses" FOR SELECT TO "authenticated" USING ("public"."is_active_group_member"("group_id"));



CREATE POLICY "expenses_update_creator_admin" ON "public"."expenses" FOR UPDATE TO "authenticated" USING ("public"."can_manage_expense"("id")) WITH CHECK ("public"."can_manage_expense"("id"));



ALTER TABLE "public"."group_invites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_invites_insert_admin" ON "public"."group_invites" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND "public"."is_group_admin"("group_id")));



CREATE POLICY "group_invites_select_admin" ON "public"."group_invites" FOR SELECT TO "authenticated" USING ("public"."is_group_admin"("group_id"));



CREATE POLICY "group_invites_update_admin" ON "public"."group_invites" FOR UPDATE TO "authenticated" USING ("public"."is_group_admin"("group_id")) WITH CHECK ("public"."is_group_admin"("group_id"));



ALTER TABLE "public"."group_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "group_members_select_member" ON "public"."group_members" FOR SELECT TO "authenticated" USING ("public"."is_active_group_member"("group_id"));



CREATE POLICY "group_members_update_admin_or_self" ON "public"."group_members" FOR UPDATE TO "authenticated" USING (("public"."is_group_admin"("group_id") OR ("user_id" = "auth"."uid"()))) WITH CHECK (("public"."is_group_admin"("group_id") OR (("user_id" = "auth"."uid"()) AND ("status" = 'left'::"text"))));



ALTER TABLE "public"."groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "groups_insert_creator" ON "public"."groups" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = "auth"."uid"()));



CREATE POLICY "groups_select_member" ON "public"."groups" FOR SELECT TO "authenticated" USING ("public"."is_active_group_member"("id"));



CREATE POLICY "groups_update_admin" ON "public"."groups" FOR UPDATE TO "authenticated" USING ("public"."is_group_admin"("id")) WITH CHECK ("public"."is_group_admin"("id"));



ALTER TABLE "public"."payments" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "payments_insert_payer" ON "public"."payments" FOR INSERT TO "authenticated" WITH CHECK ((("created_by" = "auth"."uid"()) AND ("from_user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND ("confirmed_at" IS NULL) AND "public"."is_active_group_member"("group_id") AND "public"."is_active_group_member"("group_id", "to_user_id")));



CREATE POLICY "payments_select_member" ON "public"."payments" FOR SELECT TO "authenticated" USING ("public"."is_active_group_member"("group_id"));



CREATE POLICY "payments_update_recipient" ON "public"."payments" FOR UPDATE TO "authenticated" USING ((("to_user_id" = "auth"."uid"()) AND ("status" = 'pending'::"text") AND "public"."is_active_group_member"("group_id"))) WITH CHECK ((("to_user_id" = "auth"."uid"()) AND ("status" = ANY (ARRAY['confirmed'::"text", 'rejected'::"text"])) AND "public"."is_active_group_member"("group_id")));



ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "profiles_insert_self" ON "public"."profiles" FOR INSERT TO "authenticated" WITH CHECK (("id" = "auth"."uid"()));



CREATE POLICY "profiles_select_visible" ON "public"."profiles" FOR SELECT TO "authenticated" USING ("public"."can_view_profile"("id"));



CREATE POLICY "profiles_update_self" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("id" = "auth"."uid"())) WITH CHECK (("id" = "auth"."uid"()));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."accept_group_invite"("p_token_hash" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."accept_group_invite"("p_token_hash" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_manage_expense"("p_expense_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_manage_expense"("p_expense_id" "uuid", "p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."can_view_profile"("p_profile_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_profile"("p_profile_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_expense"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_expense"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."create_expense_multi"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_expense_multi"("p_group_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_active_group_member"("p_group_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_active_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_group_admin"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_expense"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_expense"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_paid_by" "uuid", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."update_expense_multi"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."update_expense_multi"("p_expense_id" "uuid", "p_description" "text", "p_amount_paise" bigint, "p_payers" "jsonb", "p_split_type" "text", "p_splits" "jsonb", "p_notes" "text") TO "authenticated";



REVOKE ALL ON FUNCTION "public"."void_expense"("p_expense_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."void_expense"("p_expense_id" "uuid") TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_events" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_events" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."activity_events" TO "service_role";



GRANT SELECT,USAGE ON SEQUENCE "public"."activity_events_id_seq" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expense_payers" TO "service_role";
GRANT SELECT ON TABLE "public"."expense_payers" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expense_splits" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expense_splits" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expense_splits" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."expenses" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_invites" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_invites" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_invites" TO "service_role";



GRANT UPDATE("revoked_at") ON TABLE "public"."group_invites" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_members" TO "anon";
GRANT SELECT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."group_members" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."group_members" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."groups" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."groups" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."groups" TO "service_role";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."payments" TO "service_role";



GRANT UPDATE("status") ON TABLE "public"."payments" TO "authenticated";



GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "anon";
GRANT SELECT,INSERT,REFERENCES,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE "public"."profiles" TO "authenticated";
GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLE "public"."profiles" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT REFERENCES,TRIGGER,TRUNCATE,MAINTAIN ON TABLES TO "service_role";







