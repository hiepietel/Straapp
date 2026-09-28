import { useEffect, useState, useSyncExternalStore } from "react";
import { checkSession, isChecking, isDemo, isSignedIn, signOut, startLogin, subscribe } from "../services/auth";
import { getErrorMessage } from "../utils/errors";

/**
 * demo       VITE_DEMO=true, so there is nothing to log in to
 * checking   finishing a login, or checking a saved token with the API
 * signedOut  show the login screen
 * signedIn   have a token the API accepts
 */
export type AuthStatus = "demo" | "checking" | "signedOut" | "signedIn";

export interface UseAuthResult {
  status: AuthStatus;
  /** Why the last login attempt failed, if it did. */
  error: string | null;
  login: () => void;
  logout: () => void;
}

export function useAuth(): UseAuthResult {
  const signedIn = useSyncExternalStore(subscribe, isSignedIn);
  const checking = useSyncExternalStore(subscribe, isChecking);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    checkSession().catch((err: unknown) => {
      if (active) setError(getErrorMessage(err));
    });
    return () => {
      active = false;
    };
  }, []);

  const login = () => {
    setError(null);
    startLogin().catch((err: unknown) => setError(getErrorMessage(err)));
  };

  const logout = () => {
    signOut().catch((err: unknown) => setError(getErrorMessage(err)));
  };

  const status: AuthStatus = isDemo ? "demo" : checking ? "checking" : signedIn ? "signedIn" : "signedOut";

  return { status, error, login, logout };
}
