CREATE TABLE public.instagram_pending_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  recipient_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error_subcode INTEGER,
  last_error TEXT,
  raw_error JSONB,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  reopened_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT instagram_pending_replies_status_check CHECK (status IN ('pending', 'sent', 'failed', 'cancelled'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.instagram_pending_replies TO authenticated;
GRANT ALL ON public.instagram_pending_replies TO service_role;

ALTER TABLE public.instagram_pending_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own Instagram pending replies"
ON public.instagram_pending_replies
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users create own Instagram pending replies"
ON public.instagram_pending_replies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own Instagram pending replies"
ON public.instagram_pending_replies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own Instagram pending replies"
ON public.instagram_pending_replies
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE INDEX idx_instagram_pending_replies_user_status
ON public.instagram_pending_replies (user_id, status, created_at DESC);

CREATE INDEX idx_instagram_pending_replies_recipient_pending
ON public.instagram_pending_replies (user_id, recipient_id)
WHERE status = 'pending';

CREATE TRIGGER update_instagram_pending_replies_updated_at
BEFORE UPDATE ON public.instagram_pending_replies
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();