import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "../firebase/client";
import { BACKEND_API_URL } from "../services/api";

export type FirebaseAuthContextValue = {
  /** Firebase is configured via env and Auth is available. */
  isConfigured: boolean;
  /** Current Firebase user, or null when signed out. */
  user: User | null;
  /** True until first auth state event when Firebase is configured. */
  loading: boolean;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  createUserWithEmailPassword: (
    email: string,
    password: string,
  ) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  signOutFirebase: () => Promise<void>;
};

const defaultValue: FirebaseAuthContextValue = {
  isConfigured: false,
  user: null,
  loading: false,
  signInWithEmailPassword: async () => {
    throw new Error("Firebase Auth is not configured");
  },
  createUserWithEmailPassword: async () => {
    throw new Error("Firebase Auth is not configured");
  },
  sendPasswordReset: async () => {
    throw new Error("Firebase Auth is not configured");
  },
  signOutFirebase: async () => {},
};

const FirebaseAuthContext =
  createContext<FirebaseAuthContextValue>(defaultValue);

export function FirebaseAuthProvider({ children }: { children: ReactNode }) {
  const auth = getFirebaseAuth();
  const isConfigured = auth !== null;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!auth) {
      setUser(null);
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, (next) => {
      setUser(next);
      setLoading(false);
    });
    return () => unsub();
  }, [auth]);

  const value = useMemo((): FirebaseAuthContextValue => {
    if (!auth) {
      return defaultValue;
    }
    return {
      isConfigured: true,
      user,
      loading,
      signInWithEmailPassword: async (email, password) => {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      createUserWithEmailPassword: async (email, password) => {
        await createUserWithEmailAndPassword(auth, email.trim(), password);
      },
      sendPasswordReset: async (email) => {
        const trimmed = email.trim();
        const viaBackend =
          import.meta.env.VITE_PASSWORD_RESET_VIA_BACKEND === "true";
        if (viaBackend) {
          const res = await fetch(`${BACKEND_API_URL}/api/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: trimmed }),
          });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as {
              error?: string;
            };
            throw new Error(
              typeof j.error === "string"
                ? j.error
                : "Could not send reset email.",
            );
          }
          return;
        }
        await sendPasswordResetEmail(auth, trimmed);
      },
      signOutFirebase: () => signOut(auth),
    };
  }, [auth, user, loading]);

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export function useFirebaseAuth(): FirebaseAuthContextValue {
  return useContext(FirebaseAuthContext);
}
