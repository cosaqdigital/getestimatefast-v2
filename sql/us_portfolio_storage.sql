-- PREPARED ONLY, Supabase isolated development environment; not used by PGlite.
-- Images are public ONLY after explicit upload permission; never use this bucket for private documents.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('gef-portfolio','gef-portfolio',true,3000000,array['image/jpeg','image/png','image/webp'])
on conflict(id) do nothing;
-- Uploads are backend mediated. No browser INSERT/UPDATE/DELETE policies are added.
-- Object paths are generated as authenticated contractor UUID/random UUID.extension.
