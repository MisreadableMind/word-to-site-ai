import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, apiSend } from "./api";

export interface User {
  id: string;
  email: string;
  displayName: string | null;
  planTier: string;
}

interface UserResponse {
  success: boolean;
  user: User;
}

export const meKey = ["me"] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: () => api<UserResponse>("/api/auth/me").then((r) => r.user),
    retry: false,
    staleTime: 60_000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: { email: string; password: string }) =>
      apiSend<UserResponse>("/api/auth/login", "POST", vars),
    onSuccess: (data) => qc.setQueryData(meKey, data.user),
  });
}

export function useRegister() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (vars: {
      email: string;
      password: string;
      displayName?: string;
    }) => apiSend<UserResponse>("/api/auth/register", "POST", vars),
    onSuccess: (data) => qc.setQueryData(meKey, data.user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend<{ success: boolean }>("/api/auth/logout", "POST"),
    onSuccess: () => qc.clear(),
  });
}

export function initials(s: string | null | undefined): string {
  return (
    (s || "?")
      .split(/[\s@]/)
      .map((w) => w[0]?.toUpperCase())
      .filter(Boolean)
      .slice(0, 2)
      .join("") || "?"
  );
}
