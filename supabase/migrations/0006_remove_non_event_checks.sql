-- Remove early pilot observations collected before provider-specific event-path
-- and India/online scope checks existed. Their missing format means they are
-- not suitable verification evidence.
delete from public.hackathon_source_checks where format is null;
