SET check_function_bodies = off;

-- BASE OBJECTS

-- SOURCE: private/schema.sql

CREATE SCHEMA "private";

GRANT USAGE ON SCHEMA "private" TO "authenticated";

-- SOURCE: public/schema.sql

COMMENT ON SCHEMA "public" IS 'standard public schema';

REVOKE ALL ON SCHEMA "public" FROM PUBLIC;

GRANT USAGE ON SCHEMA "public" TO PUBLIC;

REVOKE ALL ON SCHEMA "public" FROM "anon";

GRANT USAGE ON SCHEMA "public" TO "anon";

REVOKE ALL ON SCHEMA "public" FROM "authenticated";

GRANT USAGE ON SCHEMA "public" TO "authenticated";

REVOKE ALL ON SCHEMA "public" FROM "pg_database_owner";

GRANT CREATE, USAGE ON SCHEMA "public" TO "pg_database_owner";

REVOKE ALL ON SCHEMA "public" FROM "postgres";

GRANT USAGE ON SCHEMA "public" TO "postgres";

REVOKE ALL ON SCHEMA "public" FROM "service_role";

GRANT USAGE ON SCHEMA "public" TO "service_role";

-- SOURCE: public/adp_wipes.sql

-- Clears assumed destination defaults before creating objects.
-- Safe to load on a project that does not have those defaults.

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "service_role";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "service_role";

-- SOURCE: _cluster/extensions/pgcrypto.sql

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA "extensions";

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';

-- SOURCE: _cluster/extensions/uuid-ossp.sql

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA "extensions";

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';

-- SOURCE: public/types/session_access_type.sql

CREATE TYPE "public"."session_access_type" AS ENUM (
  'community',
  'invitation_only'
);

GRANT USAGE ON TYPE "public"."session_access_type" TO "authenticated";

-- SOURCE: public/types/session_member_status.sql

CREATE TYPE "public"."session_member_status" AS ENUM (
  'invited',
  'accepted',
  'declined',
  'removed'
);

GRANT USAGE ON TYPE "public"."session_member_status" TO "authenticated";

-- SOURCE: public/types/session_role.sql

CREATE TYPE "public"."session_role" AS ENUM (
  'organizer',
  'in_charge',
  'participant'
);

GRANT USAGE ON TYPE "public"."session_role" TO "authenticated";

-- SOURCE: public/types/session_status.sql

CREATE TYPE "public"."session_status" AS ENUM (
  'scheduled',
  'live',
  'ended',
  'cancelled'
);

GRANT USAGE ON TYPE "public"."session_status" TO "authenticated";

-- TABLES
CREATE TABLE "public"."profiles" (
  "id"           uuid                     NOT NULL,
  "display_name" text                     NOT NULL DEFAULT 'Member'::text,
  "avatar_path"  text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "profiles_display_name_check" CHECK (((char_length(display_name) >= 1) AND (char_length(display_name) <= 80))),
  CONSTRAINT "profiles_display_name_not_blank" CHECK ((btrim(display_name) <> ''::text)),
  CONSTRAINT "profiles_id_fkey" FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "profiles_pkey" PRIMARY KEY (id)
);

CREATE TABLE "public"."sessions" (
  "id"          uuid NOT NULL DEFAULT gen_random_uuid(),
  "title"       text NOT NULL,
  "description" text,
  CONSTRAINT "sessions_description_check" CHECK (((description IS NULL) OR (char_length(description) <= 2000))),
  CONSTRAINT "sessions_pkey" PRIMARY KEY (id),
  CONSTRAINT "sessions_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 120)))
);

ALTER TABLE "public"."sessions"
  ADD COLUMN "access_type" public.session_access_type NOT NULL DEFAULT 'community'::public.session_access_type;

ALTER TABLE "public"."sessions"
  ADD COLUMN "status" public.session_status NOT NULL DEFAULT 'scheduled'::public.session_status;

ALTER TABLE "public"."sessions"
  ADD COLUMN "scheduled_start_at" timestamp WITH time zone;

ALTER TABLE "public"."sessions"
  ADD COLUMN "started_at" timestamp WITH time zone;

ALTER TABLE "public"."sessions"
  ADD COLUMN "ended_at" timestamp WITH time zone;

ALTER TABLE "public"."sessions"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."sessions"
  ADD COLUMN "updated_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."sessions"
  ADD COLUMN "created_by" uuid NOT NULL DEFAULT auth.uid();

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY (created_by) REFERENCES auth.users(id);

CREATE TABLE "public"."session_members" (
  "id"         uuid NOT NULL DEFAULT gen_random_uuid(),
  "session_id" uuid NOT NULL,
  "user_id"    uuid NOT NULL,
  CONSTRAINT "session_members_pkey" PRIMARY KEY (id),
  CONSTRAINT "session_members_unique_user" UNIQUE (session_id, user_id),
  CONSTRAINT "session_members_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT "session_members_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE
);

ALTER TABLE "public"."session_members"
  ADD COLUMN "role" public.session_role NOT NULL DEFAULT 'participant'::public.session_role;

ALTER TABLE "public"."session_members"
  ADD COLUMN "status" public.session_member_status NOT NULL DEFAULT 'invited'::public.session_member_status;

ALTER TABLE "public"."session_members"
  ADD COLUMN "created_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."session_members"
  ADD COLUMN "updated_at" timestamp WITH time zone NOT NULL DEFAULT now();

ALTER TABLE "public"."session_members"
  ADD CONSTRAINT "organizer_must_be_accepted" CHECK (((role <> 'organizer'::public.session_role) OR (status = 'accepted'::public.session_member_status)));

CREATE UNIQUE INDEX one_organizer_per_session ON public.session_members USING btree (session_id)
  WHERE (ROLE = 'organizer'::public.session_role);

CREATE TABLE "public"."session_documents" (
  "id"            uuid                     NOT NULL DEFAULT gen_random_uuid(),
  "session_id"    uuid                     NOT NULL,
  "title"         text                     NOT NULL,
  "storage_path"  text                     NOT NULL,
  "mime_type"     text                     NOT NULL DEFAULT 'application/pdf'::text,
  "size_bytes"    bigint                   NOT NULL,
  "is_active"     boolean                  NOT NULL DEFAULT true,
  "display_order" integer                  NOT NULL DEFAULT 0,
  "created_at"    timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "session_document_path_check" CHECK ((storage_path ~ (('^'::text || (session_id)::text) || '/[^/]+[.]pdf$'::text))),
  CONSTRAINT "session_document_session_id_id_unique" UNIQUE (session_id, id),
  CONSTRAINT "session_documents_mime_type_check" CHECK ((mime_type = 'application/pdf'::text)),
  CONSTRAINT "session_documents_pkey" PRIMARY KEY (id),
  CONSTRAINT "session_documents_size_limit" CHECK (((size_bytes >= 1) AND (size_bytes <= 104857600))),
  CONSTRAINT "session_documents_storage_path_key" UNIQUE (storage_path),
  CONSTRAINT "session_documents_title_check" CHECK (((char_length(btrim(title)) >= 1) AND (char_length(btrim(title)) <= 160))),
  CONSTRAINT "session_documents_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  "uploaded_by"   uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "session_documents_uploaded_by_fkey" FOREIGN KEY (uploaded_by) REFERENCES auth.users(id)
);

CREATE TABLE "public"."session_reader_state" (
  "session_id"          uuid                     NOT NULL,
  "current_document_id" uuid,
  "current_page"        integer                  NOT NULL DEFAULT 1,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "reader_document_belongs_to_session" FOREIGN KEY (session_id, current_document_id) REFERENCES public.session_documents(session_id, id) ON DELETE RESTRICT,
  CONSTRAINT "session_reader_state_current_page_check" CHECK ((current_page >= 1)),
  CONSTRAINT "session_reader_state_pkey" PRIMARY KEY (session_id),
  CONSTRAINT "session_reader_state_session_id_fkey" FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON DELETE CASCADE,
  "updated_by"          uuid                     NOT NULL DEFAULT auth.uid(),
  CONSTRAINT "session_reader_state_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES auth.users(id)
);

-- INDEXES
CREATE INDEX sessions_access_status_idx ON public.sessions USING btree (access_type, status);

CREATE INDEX sessions_status_start_idx ON public.sessions USING btree (status, scheduled_start_at);

CREATE INDEX session_members_session_status_idx ON public.session_members USING btree (session_id, status);

CREATE INDEX session_members_user_status_idx ON public.session_members USING btree (user_id, status);

CREATE INDEX session_documents_session_idx ON public.session_documents USING btree (session_id, display_order);

CREATE INDEX session_reader_state_updated_idx ON public.session_reader_state USING btree (updated_at);

-- RLS ENABLEMENT
ALTER TABLE "public"."profiles"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."sessions"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."session_members"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."session_documents"
  ENABLE ROW LEVEL SECURITY;

ALTER TABLE "public"."session_reader_state"
  ENABLE ROW LEVEL SECURITY;

-- FUNCTIONS

-- SOURCE: private/functions/can_access_reader_topic.sql

CREATE OR REPLACE FUNCTION private.can_access_reader_topic (
  p_topic           text,
  p_require_manager boolean
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.sessions s
    where p_topic = 'session:' || s.id::text || ':reader'
      and (
        (
          p_require_manager = true
          and private.can_manage_session(s.id)
        )
        or
        (
          p_require_manager = false
          and private.is_accepted_member(s.id)
        )
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION "private"."can_access_reader_topic"(text, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."can_access_reader_topic"(text, boolean) FROM PUBLIC;

-- SOURCE: private/functions/can_manage_session.sql

CREATE OR REPLACE FUNCTION private.can_manage_session (
  p_session_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.session_members m
    where m.session_id = p_session_id
      and m.user_id = (select auth.uid())
      and m.status = 'accepted'
      and m.role in ('organizer', 'in_charge')
  );
$function$;

GRANT EXECUTE ON FUNCTION "private"."can_manage_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."can_manage_session"(uuid) FROM PUBLIC;

-- SOURCE: private/functions/can_view_session.sql

CREATE OR REPLACE FUNCTION private.can_view_session (
  p_session_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.sessions s
    where s.id = p_session_id
      and (
        s.access_type = 'community'
        or exists (
          select 1
          from public.session_members m
          where m.session_id = s.id
            and m.user_id = (select auth.uid())
            and m.status in ('invited', 'accepted')
        )
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION "private"."can_view_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."can_view_session"(uuid) FROM PUBLIC;

-- SOURCE: private/functions/handle_new_user.sql

CREATE OR REPLACE FUNCTION private.handle_new_user()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  profile_name text;
begin
  profile_name := left(
    coalesce(
      nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Member'
    ),
    80
  );

  insert into public.profiles (id, display_name)
  values (new.id, profile_name)
  on conflict (id) do nothing;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."handle_new_user"() FROM PUBLIC;

-- SOURCE: private/functions/initialize_session.sql

CREATE OR REPLACE FUNCTION private.initialize_session()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  insert into public.session_members (
    session_id,
    user_id,
    role,
    status
  )
  values (
    new.id,
    new.created_by,
    'organizer',
    'accepted'
  );

  insert into public.session_reader_state (
    session_id,
    current_page,
    updated_by
  )
  values (
    new.id,
    1,
    new.created_by
  );

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."initialize_session"() FROM PUBLIC;

-- SOURCE: private/functions/is_accepted_member.sql

CREATE OR REPLACE FUNCTION private.is_accepted_member (
  p_session_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.session_members m
    where m.session_id = p_session_id
      and m.user_id = (select auth.uid())
      and m.status = 'accepted'
  );
$function$;

GRANT EXECUTE ON FUNCTION "private"."is_accepted_member"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."is_accepted_member"(uuid) FROM PUBLIC;

-- SOURCE: private/functions/is_session_organizer.sql

CREATE OR REPLACE FUNCTION private.is_session_organizer (
  p_session_id uuid
)
  RETURNS boolean
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
  select exists (
    select 1
    from public.session_members m
    where m.session_id = p_session_id
      and m.user_id = (select auth.uid())
      and m.status = 'accepted'
      and m.role = 'organizer'
  );
$function$;

GRANT EXECUTE ON FUNCTION "private"."is_session_organizer"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "private"."is_session_organizer"(uuid) FROM PUBLIC;

-- SOURCE: private/functions/set_updated_at.sql

CREATE OR REPLACE FUNCTION private.set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path TO ''
  AS $function$
begin
  new.updated_at = now();

  if tg_table_name = 'session_reader_state' then
    new.updated_by = auth.uid();
  end if;

  return new;
end;
$function$;

REVOKE ALL ON FUNCTION "private"."set_updated_at"() FROM PUBLIC;

-- SOURCE: public/functions/cancel_session.sql

CREATE OR REPLACE FUNCTION public.cancel_session (
  p_session_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_session_organizer(p_session_id) then
    raise exception 'Only the organizer can cancel this session';
  end if;

  update public.sessions
  set
    status = 'cancelled',
    updated_at = pg_catalog.now()
  where id = p_session_id
    and status = 'scheduled';

  if not found then
    raise exception 'Only scheduled sessions can be cancelled';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."cancel_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."cancel_session"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."cancel_session"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."cancel_session"(uuid) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/end_session.sql

CREATE OR REPLACE FUNCTION public.end_session (
  p_session_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_session_organizer(p_session_id) then
    raise exception 'Only the organizer can end this session';
  end if;

  update public.sessions
  set
    status = 'ended',
    ended_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  where id = p_session_id
    and status = 'live';

  if not found then
    raise exception 'Session is not live or does not exist';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."end_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."end_session"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."end_session"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."end_session"(uuid) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/invite_session_member.sql

CREATE OR REPLACE FUNCTION public.invite_session_member (
  p_session_id uuid,
  p_user_id    uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_status public.session_status;
  v_access_type public.session_access_type;
  v_membership_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'Invalid invitation target.';
  end if;

  if not private.is_session_organizer(p_session_id) then
    raise exception 'Only the organizer can invite members.';
  end if;

  select s.status, s.access_type
  into v_status, v_access_type
  from public.sessions s
  where s.id = p_session_id;

  if not found
     or v_status not in ('scheduled', 'live')
     or v_access_type <> 'invitation_only'
  then
    raise exception 'This session cannot accept invitations.';
  end if;

  insert into public.session_members (
    session_id,
    user_id,
    role,
    status
  )
  values (
    p_session_id,
    p_user_id,
    'participant',
    'invited'
  )
  on conflict (session_id, user_id)
  do update
  set status = 'invited'
  where public.session_members.role = 'participant'
    and public.session_members.status in ('declined', 'removed')
  returning id into v_membership_id;

  if v_membership_id is null then
    raise exception 'This user is already invited or is already a member.';
  end if;

  return v_membership_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."invite_session_member"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."invite_session_member"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."invite_session_member"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."invite_session_member"(uuid, uuid) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/join_community_session.sql

CREATE OR REPLACE FUNCTION public.join_community_session (
  p_session_id uuid
)
  RETURNS uuid
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
  v_access_type public.session_access_type;
  v_status public.session_status;
  v_membership_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select s.access_type, s.status
  into v_access_type, v_status
  from public.sessions s
  where s.id = p_session_id;

  if not found then
    raise exception 'Session not found.';
  end if;

  if v_access_type <> 'community' then
    raise exception 'This session requires an invitation.';
  end if;

  if v_status not in ('scheduled', 'live') then
    raise exception 'This session is not accepting members.';
  end if;

  insert into public.session_members (
    session_id,
    user_id,
    role,
    status
  )
  values (
    p_session_id,
    v_user_id,
    'participant',
    'accepted'
  )
  on conflict (session_id, user_id)
  do update
  set
    role = 'participant',
    status = 'accepted'
  where public.session_members.role = 'participant'
    and public.session_members.status in (
      'invited',
      'declined',
      'removed'
    )
  returning id into v_membership_id;

  if v_membership_id is null then
    raise exception 'You are already a member or cannot join this session.';
  end if;

  return v_membership_id;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."join_community_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."join_community_session"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."join_community_session"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."join_community_session"(uuid) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/leave_session.sql

CREATE OR REPLACE FUNCTION public.leave_session (
  p_session_id uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.session_members
  set
    status = 'removed',
    role = 'participant'
  where session_id = p_session_id
    and user_id = v_user_id
    and status = 'accepted'
    and role <> 'organizer';

  if not found then
    raise exception 'You cannot leave this session.';
  end if;

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."leave_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."leave_session"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."leave_session"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."leave_session"(uuid) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/remove_session_member.sql

CREATE OR REPLACE FUNCTION public.remove_session_member (
  p_session_id uuid,
  p_user_id    uuid
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'The organizer cannot remove themselves.';
  end if;

  if not private.is_session_organizer(p_session_id) then
    raise exception 'Only the organizer can remove members.';
  end if;

  update public.session_members
  set status = 'removed'
  where session_id = p_session_id
    and user_id = p_user_id
    and role <> 'organizer'
    and status in ('invited', 'accepted');

  if not found then
    raise exception 'Removable member not found.';
  end if;

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."remove_session_member"(uuid, uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."remove_session_member"(uuid, uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."remove_session_member"(uuid, uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."remove_session_member"(uuid, uuid) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/respond_to_session_invitation.sql

CREATE OR REPLACE FUNCTION public.respond_to_session_invitation (
  p_session_id uuid,
  p_accept     boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
declare
  v_user_id uuid;
  v_status public.session_status;
begin
  v_user_id := (select auth.uid());

  if v_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select s.status
  into v_status
  from public.sessions s
  where s.id = p_session_id;

  if not found or v_status not in ('scheduled', 'live') then
    raise exception 'Session is unavailable.';
  end if;

  update public.session_members
  set status = case
    when p_accept then 'accepted'::public.session_member_status
    else 'declined'::public.session_member_status
  end
  where session_id = p_session_id
    and user_id = v_user_id
    and role = 'participant'
    and status = 'invited';

  if not found then
    raise exception 'No pending invitation was found.';
  end if;

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."respond_to_session_invitation"(uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."respond_to_session_invitation"(uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."respond_to_session_invitation"(uuid, boolean) TO "postgres";

REVOKE ALL ON FUNCTION "public"."respond_to_session_invitation"(uuid, boolean) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/set_session_in_charge.sql

CREATE OR REPLACE FUNCTION public.set_session_in_charge (
  p_session_id     uuid,
  p_user_id        uuid,
  p_make_in_charge boolean
)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication required.';
  end if;

  if p_user_id is null or p_user_id = (select auth.uid()) then
    raise exception 'Invalid member selection.';
  end if;

  if not private.is_session_organizer(p_session_id) then
    raise exception 'Only the organizer can change in-charge permissions.';
  end if;

  update public.session_members
  set role = case
    when p_make_in_charge then 'in_charge'::public.session_role
    else 'participant'::public.session_role
  end
  where session_id = p_session_id
    and user_id = p_user_id
    and status = 'accepted'
    and role in ('participant', 'in_charge');

  if not found then
    raise exception 'Accepted participant not found.';
  end if;

  return true;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."set_session_in_charge"(uuid, uuid, boolean) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."set_session_in_charge"(uuid, uuid, boolean) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."set_session_in_charge"(uuid, uuid, boolean) TO "postgres";

REVOKE ALL ON FUNCTION "public"."set_session_in_charge"(uuid, uuid, boolean) FROM PUBLIC, "anon", "service_role";

-- SOURCE: public/functions/start_session.sql

CREATE OR REPLACE FUNCTION public.start_session (
  p_session_id uuid
)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO ''
  AS $function$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not private.is_session_organizer(p_session_id) then
    raise exception 'Only the organizer can start this session';
  end if;

  update public.sessions
  set
    status = 'live',
    started_at = pg_catalog.now(),
    ended_at = null,
    updated_at = pg_catalog.now()
  where id = p_session_id
    and status = 'scheduled';

  if not found then
    raise exception 'Session is not scheduled or does not exist';
  end if;
end;
$function$;

GRANT EXECUTE ON FUNCTION "public"."start_session"(uuid) TO "authenticated";

REVOKE ALL ON FUNCTION "public"."start_session"(uuid) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."start_session"(uuid) TO "postgres";

REVOKE ALL ON FUNCTION "public"."start_session"(uuid) FROM PUBLIC, "anon", "service_role";

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
  RETURNS event_trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'pg_catalog'
  AS $function$
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
$function$;

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO PUBLIC;

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."rls_auto_enable"() TO "postgres";

REVOKE ALL ON FUNCTION "public"."rls_auto_enable"() FROM "anon", "authenticated", "service_role";

-- TRIGGERS
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER on_session_created
  AFTER INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.initialize_session();

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER session_members_updated_at
  BEFORE UPDATE ON public.session_members
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

CREATE TRIGGER reader_state_updated_at
  BEFORE UPDATE ON public.session_reader_state
  FOR EACH ROW
  EXECUTE FUNCTION private.set_updated_at();

-- POLICIES
CREATE POLICY "Authenticated users can view profiles" ON "public"."profiles"
  FOR SELECT
  TO "authenticated"
  USING (true);

CREATE POLICY "Users can update their own profile" ON "public"."profiles"
  FOR UPDATE
  TO "authenticated"
  USING ((id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((id = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Members can view accessible sessions" ON "public"."sessions"
  FOR SELECT
  TO "authenticated"
  USING (private.can_view_session(id));

CREATE POLICY "Organizers can update their sessions" ON "public"."sessions"
  FOR UPDATE
  TO "authenticated"
  USING (private.is_session_organizer(id))
  WITH CHECK (private.is_session_organizer(id));

CREATE POLICY "Users can create sessions as themselves" ON "public"."sessions"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((created_by = ( SELECT auth.uid() AS uid)));

CREATE POLICY "Users can view relevant session memberships" ON "public"."session_members"
  FOR SELECT
  TO "authenticated"
  USING
    (((user_id = ( SELECT auth.uid() AS uid)) OR ((status = 'accepted'::public.session_member_status) AND private.is_accepted_member(session_id)) OR
    private.can_manage_session(session_id)));

CREATE POLICY "Accepted members can view session documents" ON "public"."session_documents"
  FOR SELECT
  TO "authenticated"
  USING (private.is_accepted_member(session_id));

CREATE POLICY "Session managers can update documents" ON "public"."session_documents"
  FOR UPDATE
  TO "authenticated"
  USING (private.can_manage_session(session_id))
  WITH CHECK (private.can_manage_session(session_id));

CREATE POLICY "Session managers can add documents" ON "public"."session_documents"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((private.can_manage_session(session_id) AND (uploaded_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY "Accepted members can view reader state" ON "public"."session_reader_state"
  FOR SELECT
  TO "authenticated"
  USING (private.is_accepted_member(session_id));

CREATE POLICY "Session managers can control reader state" ON "public"."session_reader_state"
  FOR UPDATE
  TO "authenticated"
  USING (private.can_manage_session(session_id))
  WITH CHECK (private.can_manage_session(session_id));

CREATE POLICY "Session managers can initialize reader state" ON "public"."session_reader_state"
  FOR INSERT
  TO "authenticated"
  WITH CHECK ((private.can_manage_session(session_id) AND (updated_by = ( SELECT auth.uid() AS uid))));

CREATE POLICY "Accepted members can receive reader broadcasts" ON "realtime"."messages"
  FOR SELECT
  TO "authenticated"
  USING (((EXTENSION = 'broadcast'::text) AND private.can_access_reader_topic(( SELECT realtime.topic() AS topic), false)));

CREATE POLICY "Session managers can send reader broadcasts" ON "realtime"."messages"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((extension = 'broadcast'::text) AND private.can_access_reader_topic(( SELECT realtime.topic() AS topic), true)));

CREATE POLICY "Session managers can upload session PDFs" ON "storage"."objects"
  FOR INSERT
  TO "authenticated"
  WITH CHECK (((bucket_id = 'session-pdfs'::text) AND (cardinality(storage.foldername(name)) = 1) AND (storage.extension(name) = 'pdf'::text) AND (EXISTS ( SELECT 1
   FROM public.sessions s
  WHERE (((s.id)::text = (storage.foldername(objects.name))[1]) AND private.can_manage_session(s.id))))));

CREATE POLICY "Session members can download session PDFs" ON "storage"."objects"
  FOR SELECT
  TO "authenticated"
  USING (((bucket_id = 'session-pdfs'::text) AND (EXISTS ( SELECT 1
   FROM public.session_documents d
  WHERE ((d.storage_path = objects.name) AND (d.is_active = true) AND private.is_accepted_member(d.session_id))))));

-- GRANTS
REVOKE ALL ON TABLE "public"."profiles" FROM "authenticated";

REVOKE ALL ("avatar_path") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("avatar_path") ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ("display_name") ON TABLE "public"."profiles" FROM "authenticated";

GRANT UPDATE ("display_name") ON TABLE "public"."profiles" TO "authenticated";

GRANT SELECT ON TABLE "public"."profiles" TO "authenticated";

REVOKE ALL ON TABLE "public"."profiles" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."profiles" TO "postgres";

REVOKE ALL ON TABLE "public"."profiles" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."profiles" TO "service_role";

REVOKE ALL ON TABLE "public"."profiles" FROM "anon";

REVOKE ALL ON TABLE "public"."sessions" FROM "authenticated";

REVOKE ALL ("access_type") ON TABLE "public"."sessions" FROM "authenticated";

GRANT INSERT ("access_type"), UPDATE ("access_type") ON TABLE "public"."sessions" TO "authenticated";

REVOKE ALL ("description") ON TABLE "public"."sessions" FROM "authenticated";

GRANT INSERT ("description"), UPDATE ("description") ON TABLE "public"."sessions" TO "authenticated";

REVOKE ALL ("scheduled_start_at") ON TABLE "public"."sessions" FROM "authenticated";

GRANT INSERT ("scheduled_start_at"), UPDATE ("scheduled_start_at") ON TABLE "public"."sessions" TO "authenticated";

REVOKE ALL ("title") ON TABLE "public"."sessions" FROM "authenticated";

GRANT INSERT ("title"), UPDATE ("title") ON TABLE "public"."sessions" TO "authenticated";

GRANT SELECT ON TABLE "public"."sessions" TO "authenticated";

REVOKE ALL ON TABLE "public"."sessions" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."sessions" TO "postgres";

REVOKE ALL ON TABLE "public"."sessions" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."sessions" TO "service_role";

REVOKE ALL ON TABLE "public"."sessions" FROM "anon";

REVOKE ALL ON TABLE "public"."session_members" FROM "authenticated";

GRANT SELECT ON TABLE "public"."session_members" TO "authenticated";

REVOKE ALL ON TABLE "public"."session_members" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."session_members" TO "postgres";

REVOKE ALL ON TABLE "public"."session_members" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."session_members" TO "service_role";

REVOKE ALL ON TABLE "public"."session_members" FROM "anon";

REVOKE ALL ON TABLE "public"."session_documents" FROM "authenticated";

REVOKE ALL ("display_order") ON TABLE "public"."session_documents" FROM "authenticated";

GRANT UPDATE ("display_order") ON TABLE "public"."session_documents" TO "authenticated";

REVOKE ALL ("is_active") ON TABLE "public"."session_documents" FROM "authenticated";

GRANT UPDATE ("is_active") ON TABLE "public"."session_documents" TO "authenticated";

REVOKE ALL ("session_id") ON TABLE "public"."session_documents" FROM "authenticated";

GRANT INSERT ("session_id") ON TABLE "public"."session_documents" TO "authenticated";

REVOKE ALL ("size_bytes") ON TABLE "public"."session_documents" FROM "authenticated";

GRANT INSERT ("size_bytes") ON TABLE "public"."session_documents" TO "authenticated";

REVOKE ALL ("storage_path") ON TABLE "public"."session_documents" FROM "authenticated";

GRANT INSERT ("storage_path") ON TABLE "public"."session_documents" TO "authenticated";

REVOKE ALL ("title") ON TABLE "public"."session_documents" FROM "authenticated";

GRANT INSERT ("title"), UPDATE ("title") ON TABLE "public"."session_documents" TO "authenticated";

GRANT INSERT, SELECT ON TABLE "public"."session_documents" TO "authenticated";

REVOKE ALL ON TABLE "public"."session_documents" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."session_documents" TO "postgres";

REVOKE ALL ON TABLE "public"."session_documents" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."session_documents" TO "service_role";

REVOKE ALL ON TABLE "public"."session_documents" FROM "anon";

REVOKE ALL ON TABLE "public"."session_reader_state" FROM "authenticated";

REVOKE ALL ("current_document_id") ON TABLE "public"."session_reader_state" FROM "authenticated";

GRANT INSERT ("current_document_id"), UPDATE ("current_document_id") ON TABLE "public"."session_reader_state" TO "authenticated";

REVOKE ALL ("current_page") ON TABLE "public"."session_reader_state" FROM "authenticated";

GRANT INSERT ("current_page"), UPDATE ("current_page") ON TABLE "public"."session_reader_state" TO "authenticated";

REVOKE ALL ("session_id") ON TABLE "public"."session_reader_state" FROM "authenticated";

GRANT INSERT ("session_id") ON TABLE "public"."session_reader_state" TO "authenticated";

GRANT INSERT, SELECT, UPDATE ON TABLE "public"."session_reader_state" TO "authenticated";

REVOKE ALL ON TABLE "public"."session_reader_state" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."session_reader_state" TO "postgres";

REVOKE ALL ON TABLE "public"."session_reader_state" FROM "service_role";

GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE "public"."session_reader_state" TO "service_role";

REVOKE ALL ON TABLE "public"."session_reader_state" FROM "anon";

-- FINAL OBJECTS

-- SOURCE: auth/tables/users.sql

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION private.handle_new_user();

-- SOURCE: _cluster/publications.sql

ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."session_reader_state";

-- SOURCE: _cluster/event_triggers.sql

CREATE EVENT TRIGGER "ensure_rls"
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
  EXECUTE FUNCTION "public"."rls_auto_enable"();

-- SOURCE: public/default_privileges.sql

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM PUBLIC;

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "anon";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "authenticated";

ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLES TO "service_role";


SET check_function_bodies = on;
