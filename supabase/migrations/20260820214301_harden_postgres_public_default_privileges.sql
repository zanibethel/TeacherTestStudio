-- Future public-schema objects created by postgres should not gain anonymous
-- Data API access implicitly. Authenticated users retain normal CRUD defaults,
-- but not database-management privileges browser/server clients do not need.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke usage, select on sequences from anon;
alter default privileges for role postgres in schema public revoke execute on functions from anon;
alter default privileges for role postgres in schema public revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke truncate, references, trigger on tables from authenticated;
