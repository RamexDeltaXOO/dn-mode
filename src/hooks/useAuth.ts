import { trpc } from "@/providers/trpc";
import { useCallback, useMemo } from "react";

type UnifiedUser = {
  id: number;
  email: string | null;
  name: string | null;
  avatar?: string | null;
  role: string;
};

export function useAuth() {
  const {
    data: localUser,
    isLoading,
  } = trpc.localAuth.me.useQuery(undefined, {
    staleTime: 1000 * 60 * 5,
    retry: false,
  });


  const user: UnifiedUser | null = useMemo(() => {
    if (localUser) {
      return {
        id: localUser.id,
        email: localUser.email,
        name: localUser.name,
        avatar: localUser.avatar,
        role: localUser.role,
      };
    }
    return null;
  }, [localUser]);

  const isAuthenticated = !!user;

  const logout = useCallback(() => {
    // La session tient entierement dans le jeton stocke cote client :
    // le supprimer suffit a se deconnecter.
    localStorage.removeItem("dnmode_local_token");
    window.location.reload();
  }, []);

  return useMemo(
    () => ({
      user,
      isAuthenticated,
      isLoading,
      isAdmin: user?.role === "admin",
      logout,
    }),
    [user, isAuthenticated, isLoading, logout],
  );
}
