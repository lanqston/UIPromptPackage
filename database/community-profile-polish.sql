-- Additive migration for the existing Community database.
begin;
alter table public.community_profiles add column cover text not null default '' check (cover='' or cover like id::text || '/%');
alter table public.community_profiles add column cover_theme text not null default 'mint' check (cover_theme in ('mint','sky','sunset','violet','graphite'));
grant update(cover,cover_theme) on public.community_profiles to authenticated;
-- Private channel access is restricted to verified, unsuspended members.
create policy community_presence_read on realtime.messages for select to authenticated
using ((select realtime.topic())='digivated-community-presence' and extension='presence' and community_private.can_write());
create policy community_presence_write on realtime.messages for insert to authenticated
with check ((select realtime.topic())='digivated-community-presence' and extension='presence' and community_private.can_write());
-- Fixed server-enforced upload budget; clients cannot choose the limit.
create function community_private.reserve_upload() returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not community_private.can_write() then raise exception 'Verify your email before uploading'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
 perform community_private.take_slot('upload',20,3600);
end;$$;
revoke all on function community_private.reserve_upload() from public,anon;
grant execute on function community_private.reserve_upload() to authenticated;
create function public.community_reserve_upload() returns void language sql security invoker set search_path='' as $$ select community_private.reserve_upload(); $$;
revoke all on function public.community_reserve_upload() from public,anon;
grant execute on function public.community_reserve_upload() to authenticated;
commit;
