-- Apply to a dedicated Digivated Supabase project, never to an unrelated database.
begin;
create schema if not exists community_private;
revoke all on schema community_private from public, anon, authenticated;
create table public.community_profiles (
 id uuid primary key references auth.users on delete cascade,
 handle text not null unique check (handle ~ '^[a-z0-9_]{3,24}$' and handle not in ('admin','digivated','support','moderator')),
 name text not null check (char_length(name) between 1 and 60),
 bio text not null default '' check (char_length(bio)<=240),
 website text not null default '' check (website='' or website ~ '^https://[^[:space:]]+$'),
 interests text[] not null default '{}' check (cardinality(interests)<=5),
 avatar text not null default '' check(avatar='' or avatar like id::text || '/%'), created_at timestamptz not null default now()
);
create table public.community_suspensions (user_id uuid primary key references auth.users on delete cascade, created_at timestamptz not null default now());
create function community_private.can_write() returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not is_anonymous)
 and not exists(select 1 from public.community_suspensions where user_id=auth.uid());
$$;
revoke all on function community_private.can_write() from public;
grant usage on schema community_private to authenticated;
grant execute on function community_private.can_write() to authenticated;
create table public.community_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references public.community_profiles on delete cascade,
 body text not null check(char_length(body) between 1 and 2000), image text not null default '',
 kind text not null default 'post' check(kind in ('post','project','chat','reply')),
 parent_id uuid references public.community_posts on delete cascade,
 project_url text not null default '' check(project_url='' or project_url ~ '^https://[^[:space:]]+$'),
 hidden boolean not null default false, created_at timestamptz not null default now(),
 check(image='' or image like author_id::text || '/%'),
 check((kind='reply')=(parent_id is not null)), check(kind<>'chat' or (char_length(body)<=600 and image=''))
);
create index community_posts_feed on public.community_posts(created_at desc) where not hidden;
create index community_posts_author on public.community_posts(author_id,created_at desc);
create index community_posts_parent on public.community_posts(parent_id);
create table public.community_follows (user_id uuid references public.community_profiles on delete cascade, target_id uuid references public.community_profiles on delete cascade, primary key(user_id,target_id),check(user_id<>target_id));
create index community_follows_target on public.community_follows(target_id);
create table public.community_likes (user_id uuid references public.community_profiles on delete cascade, post_id uuid references public.community_posts on delete cascade,primary key(user_id,post_id));
create index community_likes_post on public.community_likes(post_id);
create table public.community_bookmarks (user_id uuid references public.community_profiles on delete cascade,post_id uuid references public.community_posts on delete cascade,primary key(user_id,post_id));
create table public.community_mutes (user_id uuid references public.community_profiles on delete cascade,target_id uuid references public.community_profiles on delete cascade,primary key(user_id,target_id),check(user_id<>target_id));
create table public.community_reports (id uuid primary key default gen_random_uuid(),user_id uuid not null references public.community_profiles on delete cascade,post_id uuid not null references public.community_posts on delete cascade,reason text not null check(char_length(reason) between 3 and 500),resolved boolean not null default false,created_at timestamptz not null default now(),unique(user_id,post_id));
-- Server timestamps and moderation fields cannot be set by members.
create table community_private.write_limits (user_id uuid references auth.users on delete cascade, action text, bucket bigint not null, attempts integer not null, primary key(user_id,action));
revoke all on community_private.write_limits from public,anon,authenticated;
create function community_private.take_slot(action_name text, max_count integer, seconds integer) returns void language plpgsql security definer set search_path='' as $$
declare b bigint; n integer;
begin
 b=floor(extract(epoch from now())/seconds);
 insert into community_private.write_limits(user_id,action,bucket,attempts) values(auth.uid(),action_name,b,1)
 on conflict(user_id,action) do update set bucket=excluded.bucket, attempts=case when write_limits.bucket=excluded.bucket then write_limits.attempts+1 else 1 end returning attempts into n;
 if n>max_count then raise exception 'Take a moment before trying again'; end if;
end;$$;
revoke all on function community_private.take_slot(text,integer,integer) from public,anon,authenticated;
create function community_private.guard_write() returns trigger language plpgsql security definer set search_path='' as $$
declare recent integer;
begin
 if auth.uid() is null then raise exception 'Sign in to continue'; end if;
 if not community_private.can_write() then raise exception 'Posting is unavailable for this account'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 if TG_TABLE_NAME='community_posts' then
  if TG_OP='INSERT' then
   perform community_private.take_slot('post',10,60);
   new.created_at=now();new.hidden=false;new.author_id=auth.uid();
   if new.parent_id is not null and not exists(select 1 from public.community_posts where id=new.parent_id and not hidden and kind in ('post','project')) then raise exception 'This conversation is unavailable';end if;
  else
   new.created_at=old.created_at;new.author_id=old.author_id;new.hidden=old.hidden;new.kind=old.kind;new.parent_id=old.parent_id;
  end if;
 elsif TG_TABLE_NAME='community_profiles' then
  new.id=auth.uid();
  if TG_OP='INSERT' then new.created_at=now();else new.created_at=old.created_at;end if;
 elsif TG_TABLE_NAME='community_reports' then
  perform community_private.take_slot('report',10,3600);
  new.user_id=auth.uid();new.created_at=now();new.resolved=false;
 end if;
 return new;
end;$$;
revoke all on function community_private.guard_write() from public,anon,authenticated;
create trigger guard_posts before insert or update of body,image,kind,parent_id,project_url,author_id,created_at on public.community_posts for each row execute function community_private.guard_write();
create trigger guard_profiles before insert or update on public.community_profiles for each row execute function community_private.guard_write();
create trigger guard_reports before insert on public.community_reports for each row execute function community_private.guard_write();
alter table public.community_profiles enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_follows enable row level security;
alter table public.community_likes enable row level security;
alter table public.community_bookmarks enable row level security;
alter table public.community_mutes enable row level security;
alter table public.community_reports enable row level security;
alter table public.community_suspensions enable row level security;
revoke all on public.community_profiles,public.community_posts,public.community_follows,public.community_likes,public.community_bookmarks,public.community_mutes,public.community_reports,public.community_suspensions from public,anon,authenticated;
grant select on public.community_profiles,public.community_posts,public.community_follows,public.community_likes to anon,authenticated;
grant select on public.community_bookmarks,public.community_mutes,public.community_reports to authenticated;
grant insert on public.community_profiles,public.community_posts,public.community_follows,public.community_likes,public.community_bookmarks,public.community_mutes,public.community_reports to authenticated;
grant update(name,bio,website,interests,avatar,handle) on public.community_profiles to authenticated;
grant update(body,image,project_url) on public.community_posts to authenticated;
grant delete on public.community_posts,public.community_follows,public.community_likes,public.community_bookmarks,public.community_mutes to authenticated;
create policy profiles_read on public.community_profiles for select using(true);
create policy profiles_add on public.community_profiles for insert to authenticated with check(id=(select auth.uid()) and community_private.can_write());
create policy profiles_edit on public.community_profiles for update to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()) and community_private.can_write());
create policy posts_read on public.community_posts for select using(not hidden);
create policy posts_add on public.community_posts for insert to authenticated with check(author_id=(select auth.uid()) and not hidden and community_private.can_write());
create policy posts_edit on public.community_posts for update to authenticated using(author_id=(select auth.uid()) and not hidden) with check(author_id=(select auth.uid()) and not hidden and community_private.can_write());
create policy posts_delete on public.community_posts for delete to authenticated using(author_id=(select auth.uid()));
create policy follows_read on public.community_follows for select using(true);
create policy likes_read on public.community_likes for select using(exists(select 1 from public.community_posts where id=post_id));
create policy bookmarks_read on public.community_bookmarks for select to authenticated using(user_id=(select auth.uid()));
create policy mutes_read on public.community_mutes for select to authenticated using(user_id=(select auth.uid()));
create policy reports_read on public.community_reports for select to authenticated using(user_id=(select auth.uid()));
create policy reports_add on public.community_reports for insert to authenticated with check(user_id=(select auth.uid()) and not resolved and community_private.can_write());
do $$ declare t text;begin
 foreach t in array array['community_follows','community_likes','community_bookmarks','community_mutes'] loop
 execute format('create policy member_add on public.%I for insert to authenticated with check(user_id=(select auth.uid()) and community_private.can_write())',t);
 execute format('create policy member_remove on public.%I for delete to authenticated using(user_id=(select auth.uid()))',t);
 end loop;end $$;
-- Image uploads go through the rate-limited server endpoint. Public reads only.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('community-media','community-media',true,2097152,array['image/jpeg','image/png','image/webp']);
-- Add realtime for committed message delivery. Presence is optional, not inferred from visits.
alter publication supabase_realtime add table public.community_posts;
grant all on public.community_suspensions to service_role;
create function public.community_post_counts(post_ids uuid[]) returns table(post_id uuid, likes bigint, replies bigint)
language sql stable security invoker set search_path='' as $$
 select p.id,(select count(*) from public.community_likes l where l.post_id=p.id),(select count(*) from public.community_posts r where r.parent_id=p.id)
 from public.community_posts p where p.id=any(post_ids[1:20]);
$$;
revoke all on function public.community_post_counts(uuid[]) from public;
grant execute on function public.community_post_counts(uuid[]) to anon,authenticated;
commit;
