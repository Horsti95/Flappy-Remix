-- 0017: retire friend_code entirely.
--
-- Friends are added by @username now (0014 friend requests), so the legacy
-- friend_code column, its auto-assign trigger, and the generator function are
-- all dead weight. The app no longer reads or writes friend_code anywhere.
-- Re-runnable.

drop trigger if exists profiles_assign_friend_code on public.profiles;
drop function if exists public.assign_friend_code();
drop function if exists public.gen_friend_code();

alter table public.profiles drop column if exists friend_code;
