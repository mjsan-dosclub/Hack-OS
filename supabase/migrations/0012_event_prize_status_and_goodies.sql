-- Preserve whether prize amounts were actually announced, rather than treating
-- an unknown amount as a zero-value cash prize. Goodies are tracked separately.
ALTER TABLE public.hackathons
  ADD COLUMN cash_prize_status text NOT NULL DEFAULT 'unannounced',
  ADD COLUMN goodies_available boolean NOT NULL DEFAULT false;

UPDATE public.hackathons
SET cash_prize_status = CASE
  WHEN total_prize_value > 0 THEN 'announced'
  ELSE 'unannounced'
END;

ALTER TABLE public.hackathons
  ADD CONSTRAINT hackathons_cash_prize_status_ck
  CHECK (cash_prize_status IN ('announced', 'unannounced', 'no-cash-prize'));
