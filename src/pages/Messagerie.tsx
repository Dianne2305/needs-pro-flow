/**
 * Messagerie.tsx
 * Chat interne back-office : conversations individuelles + diffusion à tous.
 * In-app uniquement, realtime via Supabase. Identité via session ou sélecteur (localStorage).
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Megaphone, Search, Trash2, Users, UserCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type ChatUser = { id: string; display_name: string | null; avatar_url: string | null };
type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  recipient_id: string | null;
  content: string;
  type: "direct" | "broadcast";
  created_at: string;
};

const BROADCAST_KEY = "__broadcast__";
const LS_KEY = "messagerie_current_user_id";

export default function Messagerie() {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [meId, setMeId] = useState<string | null>(() => localStorage.getItem(LS_KEY));
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reads, setReads] = useState<Set<string>>(new Set());
  const [activeKey, setActiveKey] = useState<string>(BROADCAST_KEY);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load users + auto-detect current user via session
  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.rpc("get_directory_profiles");
      const list = (u as ChatUser[]) || [];
      setUsers(list);
      if (!meId) {
        const { data: s } = await supabase.auth.getSession();
        const sid = s?.session?.user?.id;
        if (sid && list.some((x) => x.id === sid)) {
          setMeId(sid);
          localStorage.setItem(LS_KEY, sid);
        }
      }
    })();
  }, []);

  // Load messages + reads (when identity known)
  useEffect(() => {
    if (!meId) return;
    (async () => {
      const [{ data: m }, { data: r }] = await Promise.all([
        supabase.from("chat_messages").select("*").order("created_at", { ascending: true }).limit(2000),
        supabase.from("chat_reads").select("message_id").eq("user_id", meId),
      ]);
      setMessages((m as ChatMessage[]) || []);
      setReads(new Set((r || []).map((x: any) => x.message_id)));
    })();

    const ch = supabase
      .channel(`chat-messagerie-${meId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, (p) => {
        setMessages((prev) => [...prev, p.new as ChatMessage]);
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chat_messages" }, (p) => {
        setMessages((prev) => prev.filter((m) => m.id !== (p.old as any).id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [meId]);

  // Auto scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, activeKey]);

  const currentMessages = useMemo(() => {
    if (!meId) return [];
    if (activeKey === BROADCAST_KEY) return messages.filter((m) => m.type === "broadcast" || m.recipient_id === null);
    return messages.filter(
      (m) =>
        m.type === "direct" &&
        ((m.sender_id === meId && m.recipient_id === activeKey) ||
          (m.sender_id === activeKey && m.recipient_id === meId)),
    );
  }, [messages, activeKey, meId]);

  useEffect(() => {
    if (!meId) return;
    const unread = currentMessages.filter((m) => m.sender_id !== meId && !reads.has(m.id));
    if (unread.length === 0) return;
    (async () => {
      const rows = unread.map((m) => ({ message_id: m.id, user_id: meId }));
      await supabase.from("chat_reads").upsert(rows, { onConflict: "message_id,user_id" });
      setReads((prev) => {
        const next = new Set(prev);
        unread.forEach((m) => next.add(m.id));
        return next;
      });
    })();
  }, [currentMessages, meId]);

  const unreadByKey = useMemo(() => {
    const map = new Map<string, number>();
    if (!meId) return map;
    messages.forEach((m) => {
      if (m.sender_id === meId || reads.has(m.id)) return;
      const key = m.type === "broadcast" || m.recipient_id === null ? BROADCAST_KEY : m.sender_id;
      map.set(key, (map.get(key) || 0) + 1);
    });
    return map;
  }, [messages, reads, meId]);

  const filteredUsers = useMemo(() => {
    if (!meId) return [];
    return users
      .filter((u) => u.id !== meId)
      .filter((u) => (u.display_name || "").toLowerCase().includes(search.toLowerCase()));
  }, [users, search, meId]);

  const activeUser = users.find((u) => u.id === activeKey);
  const myProfile = users.find((u) => u.id === meId);

  const send = async () => {
    if (!meId || !input.trim()) return;
    const isBroadcast = activeKey === BROADCAST_KEY;
    const payload = {
      sender_id: meId,
      sender_name: myProfile?.display_name || "Utilisateur",
      sender_avatar_url: myProfile?.avatar_url || null,
      recipient_id: isBroadcast ? null : activeKey,
      content: input.trim(),
      type: isBroadcast ? "broadcast" : "direct",
    };
    setInput("");
    const { error } = await supabase.from("chat_messages").insert(payload);
    if (error) toast({ title: "Erreur d'envoi", description: error.message, variant: "destructive" });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("chat_messages").delete().eq("id", id);
    if (error) toast({ title: "Erreur", description: error.message, variant: "destructive" });
  };

  const pickIdentity = (id: string) => {
    setMeId(id);
    localStorage.setItem(LS_KEY, id);
  };

  // Identity selector when no user is set
  if (!meId) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2">
            <UserCircle2 className="h-6 w-6 text-primary" />
            <h2 className="text-lg font-bold">Choisissez votre identité</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Sélectionnez votre nom pour accéder à la messagerie interne.
          </p>
          {users.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun utilisateur disponible.</div>
          ) : (
            <Select onValueChange={pickIdentity}>
              <SelectTrigger>
                <SelectValue placeholder="Sélectionner..." />
              </SelectTrigger>
              <SelectContent>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.display_name || "Utilisateur"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <Card className="w-80 flex flex-col">
        <div className="p-3 border-b space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Users className="h-5 w-5" /> Messagerie
            </h2>
            <button
              onClick={() => {
                localStorage.removeItem(LS_KEY);
                setMeId(null);
              }}
              className="text-[11px] text-muted-foreground hover:text-foreground underline"
              title="Changer d'utilisateur"
            >
              {myProfile?.display_name || "Moi"}
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-9"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <button
            onClick={() => setActiveKey(BROADCAST_KEY)}
            className={cn(
              "w-full flex items-center gap-3 p-3 hover:bg-muted/50 border-b text-left",
              activeKey === BROADCAST_KEY && "bg-muted",
            )}
          >
            <div className="h-10 w-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center">
              <Megaphone className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">Diffusion générale</div>
              <div className="text-xs text-muted-foreground">Message à toute l'équipe</div>
            </div>
            {(unreadByKey.get(BROADCAST_KEY) || 0) > 0 && (
              <Badge className="bg-destructive text-destructive-foreground h-5 min-w-5 px-1.5 text-[10px]">
                {unreadByKey.get(BROADCAST_KEY)}
              </Badge>
            )}
          </button>

          {filteredUsers.map((u) => {
            const unread = unreadByKey.get(u.id) || 0;
            return (
              <button
                key={u.id}
                onClick={() => setActiveKey(u.id)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 hover:bg-muted/50 border-b text-left",
                  activeKey === u.id && "bg-muted",
                )}
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={u.avatar_url || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {(u.display_name || "U").charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{u.display_name || "Utilisateur"}</div>
                </div>
                {unread > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground h-5 min-w-5 px-1.5 text-[10px]">
                    {unread}
                  </Badge>
                )}
              </button>
            );
          })}
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col">
        <div className="p-3 border-b flex items-center gap-3">
          {activeKey === BROADCAST_KEY ? (
            <>
              <div className="h-9 w-9 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <div className="font-bold">Diffusion générale</div>
                <div className="text-xs text-muted-foreground">Visible par tous les utilisateurs</div>
              </div>
            </>
          ) : (
            <>
              <Avatar className="h-9 w-9">
                <AvatarImage src={activeUser?.avatar_url || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {(activeUser?.display_name || "U").charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-bold">{activeUser?.display_name || "Utilisateur"}</div>
                <div className="text-xs text-muted-foreground">Message privé</div>
              </div>
            </>
          )}
        </div>

        <div ref={scrollerRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/20">
          {currentMessages.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              Aucun message. Commencez la conversation.
            </div>
          )}
          {currentMessages.map((m) => {
            const mine = m.sender_id === meId;
            return (
              <div key={m.id} className={cn("flex gap-2", mine ? "justify-end" : "justify-start")}>
                {!mine && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={m.sender_avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {(m.sender_name || "U").charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div className={cn("max-w-[70%] group", mine && "items-end")}>
                  {!mine && activeKey === BROADCAST_KEY && (
                    <div className="text-[11px] text-muted-foreground mb-0.5 ml-1">{m.sender_name}</div>
                  )}
                  <div
                    className={cn(
                      "rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap break-words",
                      mine ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border rounded-bl-sm",
                    )}
                  >
                    {m.content}
                  </div>
                  <div className={cn("text-[10px] text-muted-foreground mt-0.5 flex items-center gap-2", mine ? "justify-end" : "justify-start")}>
                    <span>
                      {new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {mine && (
                      <button
                        onClick={() => remove(m.id)}
                        className="opacity-0 group-hover:opacity-100 hover:text-destructive transition"
                        title="Supprimer"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="p-3 border-t flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder={
              activeKey === BROADCAST_KEY
                ? "Message à toute l'équipe..."
                : `Message à ${activeUser?.display_name || "..."}`
            }
          />
          <Button onClick={send} disabled={!input.trim()}>
            <Send className="h-4 w-4 mr-1" /> Envoyer
          </Button>
        </div>
      </Card>
    </div>
  );
}
