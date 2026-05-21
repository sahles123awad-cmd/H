import { useState, useEffect, useCallback } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";

const TOKEN_KEY = "yw_token";

export function useAuth() {
  const [token, setTokenState] = useState<string | null>(
    () => localStorage.getItem(TOKEN_KEY)
  );
  const [, setLocation] = useLocation();

  // Make sure the API client has the latest token
  useEffect(() => {
    setAuthTokenGetter(() => localStorage.getItem(TOKEN_KEY));
  }, []);

  const setToken = useCallback((newToken: string | null) => {
    if (newToken) {
      localStorage.setItem(TOKEN_KEY, newToken);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    setTokenState(newToken);
  }, []);

  const { data: user, isLoading, isError, error } = useGetMe({
    query: {
      enabled: !!token,
      queryKey: getGetMeQueryKey(),
      retry: false,
    }
  });

  useEffect(() => {
    if (isError && error?.status === 401) {
      setToken(null);
      setLocation("/login");
    }
  }, [isError, error, setToken, setLocation]);

  return {
    token,
    setToken,
    user,
    isLoading: isLoading && !!token,
    isAuthenticated: !!user,
  };
}
