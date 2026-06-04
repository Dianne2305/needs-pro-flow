
-- Messages table for back-office user chat (direct + broadcast)
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  sender_name text,
  sender_avatar_url text,
  recipient_id uuid, -- NULL = broadcast to all
  content text NOT NULL,
  type text NOT NULL DEFAULT 'direct', -- 'direct' | 'broadcast'
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_chat_messages_recipient ON public.chat_messages(recipient_id, created_at DESC);
CREATE INDEX idx_chat_messages_sender ON public.chat_messages(sender_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view messages they sent or received or broadcasts"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (recipient_id IS NULL OR sender_id = auth.uid() OR recipient_id = auth.uid());
CREATE POLICY "Users can send their own messages"
  ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());
CREATE POLICY "Users can delete their own messages"
  ON public.chat_messages FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- Read state per user / per message
CREATE TABLE public.chat_reads (
  message_id uuid NOT NULL,
  user_id uuid NOT NULL,
  read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (message_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_reads TO authenticated;
GRANT ALL ON public.chat_reads TO service_role;
ALTER TABLE public.chat_reads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own reads"
  ON public.chat_reads FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Allow authenticated users to list other users (profiles)
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT TO authenticated USING (true);

-- Enable realtime
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER TABLE public.chat_reads REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_reads;
