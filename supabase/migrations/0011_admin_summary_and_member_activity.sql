-- Admin reporting uses coarse activity types and timestamps only. Prompt text,
-- generated content, teammate choices, and assessment data are intentionally absent.
CREATE TYPE public.member_activity_type AS ENUM ('teammate_match', 'project_plan');

CREATE TABLE public.member_activity_events (
	id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
	activity public.member_activity_type NOT NULL,
	created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX member_activity_events_user_activity_created_idx
	ON public.member_activity_events (user_id, activity, created_at DESC);
CREATE INDEX member_activity_events_created_idx
	ON public.member_activity_events (created_at DESC);

ALTER TABLE public.member_activity_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can record their own feature use"
	ON public.member_activity_events FOR INSERT TO authenticated
	WITH CHECK (
		user_id = (SELECT auth.uid())
		AND coalesce((SELECT verified_member OR is_admin FROM public.current_member_access()), false)
	);

CREATE POLICY "Admins can read feature use summaries"
	ON public.member_activity_events FOR SELECT TO authenticated
	USING (
		coalesce((SELECT is_admin FROM public.current_member_access()), false)
	);

REVOKE ALL ON public.member_activity_events FROM anon;
GRANT INSERT ON public.member_activity_events TO authenticated;
GRANT SELECT ON public.member_activity_events TO authenticated;
