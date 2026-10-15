-- Transactional fixtures. Nothing is retained after this verification.
begin;
insert into auth.users(id,aud,role,email,email_confirmed_at,is_anonymous) values
('e0000000-0000-4000-8000-000000000001','authenticated','authenticated','community-test-a@example.invalid',now(),false),
('e0000000-0000-4000-8000-000000000002','authenticated','authenticated','community-test-b@example.invalid',now(),false);
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
insert into public.community_profiles(id,handle,name) values('e0000000-0000-4000-8000-000000000001','test_fixture_a','Test member A');
insert into public.community_posts(id,author_id,body) values('e0000000-0000-4000-8000-000000000010','e0000000-0000-4000-8000-000000000001','Temporary verification');
update public.community_profiles set bio='Edited by owner',cover_theme='violet',cover=auth.uid()::text||'/e0000000-0000-4000-8000-000000000011.webp' where id=auth.uid();
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
insert into public.community_profiles(id,handle,name) values('e0000000-0000-4000-8000-000000000002','test_fixture_b','Test member B');
do $$ begin
 update public.community_posts set body='Unauthorized change' where id='e0000000-0000-4000-8000-000000000010';
 if found then raise exception 'FAIL another member edited the post';end if;
 begin
 update public.community_posts set hidden=true where id='e0000000-0000-4000-8000-000000000010';
 raise exception 'FAIL moderation field writable';
 exception when insufficient_privilege then null;end;
end;$$;
insert into public.community_follows values(auth.uid(),'e0000000-0000-4000-8000-000000000001');
delete from public.community_follows where user_id=auth.uid();
insert into public.community_likes values(auth.uid(),'e0000000-0000-4000-8000-000000000010');
delete from public.community_likes where user_id=auth.uid();
insert into public.community_bookmarks values(auth.uid(),'e0000000-0000-4000-8000-000000000010');
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
do $$ begin
 if exists(select 1 from public.community_bookmarks where user_id='e0000000-0000-4000-8000-000000000002') then raise exception 'FAIL bookmarks exposed';end if;
end;$$;
do $$ begin
 for i in 1..20 loop perform public.community_reserve_upload();end loop;
 begin
 perform public.community_reserve_upload();
 raise exception 'FAIL upload budget not enforced';
 exception when raise_exception then if SQLERRM='FAIL upload budget not enforced' then raise;end if;end;
end;$$;
reset role;
insert into public.community_suspensions(user_id) values('e0000000-0000-4000-8000-000000000001');
set local role authenticated;
do $$ begin
 begin
 perform public.community_reserve_upload();
 raise exception 'FAIL suspended upload allowed';
 exception when raise_exception then if SQLERRM='FAIL suspended upload allowed' then raise;end if;end;
 begin
 insert into public.community_posts(author_id,body) values(auth.uid(),'Suspended write');
 raise exception 'FAIL suspended posting allowed';
 exception when raise_exception then if SQLERRM='FAIL suspended posting allowed' then raise;end if;end;
end;$$;
reset role;
select 'PASS owner edits, cross-member denial, protected moderation fields, follow and unfollow, like and unlike, private saves, suspension enforcement' as result;
rollback;
