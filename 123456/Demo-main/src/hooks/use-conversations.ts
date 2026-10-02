import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyConversations } from "@/lib/items";

export function useConversations(userId?: string, subscribe = false) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["my-conversations", userId],
    queryFn: fetchMyConversations,
    enabled: !!userId,
  });

  useEffect(() => {
    if (!userId || !subscribe) return;
    const channel = supabase
      .channel(`campus-conversations-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["my-conversations", userId] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "meeting_proposals" },
        () => void queryClient.invalidateQueries({ queryKey: ["my-conversations", userId] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => void queryClient.invalidateQueries({ queryKey: ["my-conversations", userId] }),
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["my-conversations", userId] });
          void queryClient.invalidateQueries({ queryKey: ["notifications", userId] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [queryClient, subscribe, userId]);

  return query;
}