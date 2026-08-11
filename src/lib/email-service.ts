// Email service utilities for frontend
import { trpc } from "@/providers/trpc";

export function useEmailTemplates() {
  return trpc.email.listTemplates.useQuery();
}

export function useSendEmail() {
  const utils = trpc.useUtils();
  return trpc.email.send.useMutation({
    onSuccess: () => utils.email.listTemplates.invalidate(),
  });
}
