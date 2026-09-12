-- Minimal Supabase-shaped scaffolding so the real migrations can apply.
create extension if not exists pgcrypto;

create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator noinherit login;
grant anon, authenticated, service_role to authenticator;

create schema if not exists auth;

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  is_anonymous boolean not null default true,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- auth.uid() reads the request JWT claims in Supabase; stubbed via a GUC here.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon');
$$;

grant usage on schema public to anon, authenticated, service_role;
grant usage on schema auth to anon, authenticated, service_role;

-- Supabase grants client roles table-wide DML and relies on RLS as the gate,
-- and it does so through ALTER DEFAULT PRIVILEGES so that every table created
-- LATER (i.e. by the migrations under test) inherits it. Setting it here, up
-- front, is what makes the privilege assertions faithful: a migration that
-- narrows access (e.g. 0036's column-level revoke on runs.inputs) then runs
-- after these defaults, exactly as it would in production.
alter default privileges in schema public
  grant select, insert, update, delete on tables to anon, authenticated;
alter default privileges in schema public
  grant usage, select on sequences to anon, authenticated;
alter default privileges in schema public
  grant all on tables to service_role;
-- Supabase's init ALSO grants FUNCTIONS to the client roles and service_role,
-- and sets the matching default privileges. Omitting the function half is what
-- made migration 0031's effect on `service_role` invisible to these tests: the
-- harness showed service_role denied on every server-side RPC, while a real
-- project would have allowed it via this default. Model it faithfully so the
-- assertions mean something either way.
alter default privileges in schema public
  grant execute on functions to postgres, anon, authenticated, service_role;
