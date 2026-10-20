"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useRouter } from "next/navigation";
import { User, Address } from "@/types";
import { useToast } from "./toast-context";
import { createClient } from "@/lib/supabase/client";

export type AppRole = "customer" | "seller" | "admin";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  authReady: boolean;
  login: (email: string) => Promise<boolean>;
  register: (
    name: string,
    email: string,
    phone: string,
  ) => Promise<{ success: boolean; error?: string }>;
  resendVerificationEmail: (email: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (email: string, token: string) => Promise<boolean>;
  getCurrentRole: () => Promise<AppRole | null>;
  logout: () => Promise<void>;
  setRole: (role: AppRole) => void;
  addAddress: (address: Omit<Address, "id">) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADDRESS_STORAGE_KEY = "rnl_customer_addresses_v1";

function getUserRole(
  appMetadata: Record<string, unknown> | undefined,
): AppRole {
  const role = appMetadata?.role;

  if (role === "seller" || role === "admin") {
    return role;
  }

  return "customer";
}

export function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { toast } = useToast();

  const supabase = useMemo(() => createClient(), []);

  const saveUser = useCallback((updated: User | null) => {
    setUser(updated);
  }, []);

  const buildUser = useCallback(
    (authUser: {
      id: string;
      email?: string;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    }): User => {
      const storedName =
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        "";

      let addresses: Address[] = [];

      // Restore addresses only for this user's customer profile.
      try {
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem(
            `${ADDRESS_STORAGE_KEY}:${authUser.id}`,
          );

          if (stored) {
            const parsed: unknown = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              addresses = parsed as Address[];
            }
          }
        }
      } catch {
        addresses = [];
      }

      return {
        id: authUser.id,
        name: typeof storedName === "string" ? storedName : "",
        email: authUser.email ?? "",
        phone:
          typeof authUser.user_metadata?.phone === "string"
            ? authUser.user_metadata.phone
            : "",
        role: getUserRole(authUser.app_metadata),
        addresses,
      };
    },
    [],
  );

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();

        if (!mounted) return;

        if (error || !data.user) {
          setUser(null);
        } else {
          setUser(buildUser(data.user));
        }
      } catch {
        if (mounted) setUser(null);
      } finally {
        if (mounted) setAuthReady(true);
      }
    };

    void loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      setUser(buildUser(session.user));
      setAuthReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, buildUser]);

  const login = useCallback(
    async (email: string): Promise<boolean> => {
      const normalizedEmail = email.trim().toLowerCase();
      const siteUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (error) {
        toast({
          type: "error",
          title: "Unable to Send Link",
          message: error.message,
        });
        return false;
      }

      toast({
        type: "success",
        title: "Check Your Email",
        message: "We sent you a verification link.",
      });

      return true;
    },
    [supabase, toast],
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      phone: string,
    ): Promise<{ success: boolean; error?: string }> => {
      const normalizedEmail = email.trim().toLowerCase();
      const siteUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      // Attempt Supabase email registration with confirmation redirect link
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password: `Rnl#${crypto.randomUUID().slice(0, 12)}!Aa9`,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
          data: {
            full_name: name.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) {
        // Fallback to signInWithOtp if signup is restricted or magic link is configured
        const fallback = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: `${siteUrl}/auth/callback`,
            data: {
              full_name: name.trim(),
              phone: phone.trim(),
            },
          },
        });

        if (fallback.error) {
          const msg = fallback.error.message || error.message;
          toast({
            type: "error",
            title: "Registration Failed",
            message: msg,
          });
          return { success: false, error: msg };
        }
      }

      toast({
        type: "success",
        title: "Check Your Inbox",
        message: "We've sent a verification link to your email address.",
      });

      return { success: true };
    },
    [supabase, toast],
  );

  const resendVerificationEmail = useCallback(
    async (email: string): Promise<{ success: boolean; error?: string }> => {
      const normalizedEmail = email.trim().toLowerCase();
      const siteUrl =
        typeof window !== "undefined"
          ? window.location.origin
          : process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

      // Try resending confirmation email via Supabase Auth
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo: `${siteUrl}/auth/callback`,
        },
      });

      if (error) {
        // If user already exists or requires magic-link format, attempt signInWithOtp resend
        const fallback = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: {
            shouldCreateUser: false,
            emailRedirectTo: `${siteUrl}/auth/callback`,
          },
        });

        if (fallback.error) {
          const msg = fallback.error.message || error.message;
          toast({
            type: "error",
            title: "Unable to Resend Email",
            message: msg,
          });
          return { success: false, error: msg };
        }
      }

      toast({
        type: "success",
        title: "Verification Email Resent",
        message: "Please check your inbox and spam folder.",
      });

      return { success: true };
    },
    [supabase, toast],
  );

  const verifyOtp = useCallback(
    async (email: string, token: string): Promise<boolean> => {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: token.trim(),
        type: "email",
      });

      if (error || !data.user) {
        toast({
          type: "error",
          title: "Verification Failed",
          message: error?.message ?? "Please request a new code.",
        });
        return false;
      }

      // Use the user returned by the successful verification immediately.
      setUser(buildUser(data.user));
      setAuthReady(true);

      toast({
        type: "success",
        title: "Email Verified",
        message: "You are now signed in.",
      });

      return true;
    },
    [supabase, toast, buildUser],
  );

  const getCurrentRole = useCallback(async (): Promise<AppRole | null> => {
    try {
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      return getUserRole(data.user.app_metadata);
    } catch {
      return null;
    }
  }, [supabase]);

  const logout = useCallback(async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast({
          type: "error",
          title: "Sign Out Failed",
          message: error.message,
        });
        return;
      }

      saveUser(null);

      toast({
        type: "success",
        title: "Signed Out",
        message: "You have been signed out.",
      });

      router.push("/");
      router.refresh();
    } catch (err) {
      toast({
        type: "error",
        title: "Sign Out Failed",
        message:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during sign out.",
      });
    }
  }, [supabase, saveUser, toast, router]);

  const persistAddresses = useCallback(
    (updated: User) => {
      saveUser(updated);

      try {
        localStorage.setItem(
          `${ADDRESS_STORAGE_KEY}:${updated.id}`,
          JSON.stringify(updated.addresses),
        );
      } catch {
        toast({
          type: "error",
          title: "Address Not Saved",
          message: "Your browser could not save this address.",
        });
      }
    },
    [saveUser, toast],
  );

  const setRole = useCallback(
    (role: AppRole) => {
      // Never allow client-side code to grant staff privileges.
      if (role !== "customer") {
        toast({
          type: "error",
          title: "Permission Denied",
          message:
            "Staff roles must be assigned securely by an administrator.",
        });
      }
    },
    [toast],
  );

  const addAddress = useCallback(
    (newAddress: Omit<Address, "id">) => {
      if (!user) return;

      const address: Address = {
        ...newAddress,
        id: crypto.randomUUID(),
      };

      const existing = user.addresses.map((item) =>
        address.isDefault ? { ...item, isDefault: false } : item,
      );

      persistAddresses({
        ...user,
        addresses: [...existing, address],
      });

      toast({
        type: "success",
        title: "Address Saved",
        message: `${address.city}, ${address.pinCode}`,
      });
    },
    [user, persistAddresses, toast],
  );

  const updateAddress = useCallback(
    (id: string, fields: Partial<Address>) => {
      if (!user) return;

      const updatedAddresses = user.addresses.map((address) => {
        if (address.id === id) return { ...address, ...fields };
        if (fields.isDefault) return { ...address, isDefault: false };
        return address;
      });

      persistAddresses({ ...user, addresses: updatedAddresses });
    },
    [user, persistAddresses],
  );

  const deleteAddress = useCallback(
    (id: string) => {
      if (!user) return;

      persistAddresses({
        ...user,
        addresses: user.addresses.filter((address) => address.id !== id),
      });

      toast({
        type: "info",
        title: "Address Deleted",
        message: "The saved address was removed.",
      });
    },
    [user, persistAddresses, toast],
  );

  const setDefaultAddress = useCallback(
    (id: string) => {
      if (!user) return;

      persistAddresses({
        ...user,
        addresses: user.addresses.map((address) => ({
          ...address,
          isDefault: address.id === id,
        })),
      });
    },
    [user, persistAddresses],
  );

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: authReady && !!user,
      authReady,
      login,
      register,
      resendVerificationEmail,
      verifyOtp,
      getCurrentRole,
      logout,
      setRole,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
    }),
    [
      user,
      authReady,
      login,
      register,
      resendVerificationEmail,
      verifyOtp,
      getCurrentRole,
      logout,
      setRole,
      addAddress,
      updateAddress,
      deleteAddress,
      setDefaultAddress,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
