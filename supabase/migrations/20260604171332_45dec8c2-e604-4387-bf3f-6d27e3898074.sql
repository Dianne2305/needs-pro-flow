
DROP POLICY IF EXISTS "Users can view messages they sent or received or broadcasts" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can send their own messages" ON public.chat_messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON public.chat_messages;
CREATE POLICY "Allow all access to chat_messages" ON public.chat_messages FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO anon;

DROP POLICY IF EXISTS "Users manage their own reads" ON public.chat_reads;
CREATE POLICY "Allow all access to chat_reads" ON public.chat_reads FOR ALL USING (true) WITH CHECK (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_reads TO anon;

GRANT SELECT ON public.profiles TO anon;
