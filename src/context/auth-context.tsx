
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
    useCallback,
  useMemo,
} from "react";
import { User, Address } from "@/types";
import { useToast } from "./toast-context";
import { createClient } from "@/lib/supabase/client";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<boolean>;
  register: (
    name: string,
    email: string,
    phone: string
  ) => Promise<boolean>;
  verifyOtp: (email: string, token: string) => Promise<boolean>;
  logout: () => void;
  setRole: (role: "customer" | "seller" | "admin") => void;
  addAddress: (address: Omit<Address, "id">) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADDRESS_STORAGE_KEY = "rnl_customer_addresses_v1";

function getUserRole(
  appMetadata: Record<string, unknown> | undefined
): "customer" | "seller" | "admin" {
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
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const { toast } = useToast();

  const supabase = useMemo(() => createClient(), []);

  const saveUser = useCallback((updated: User | null) => {
    setUser(updated);
  }, []);

  useEffect(() => {
    let mounted = true;

    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !data.user) {
        setUser(null);
        setAuthReady(true);
        return;
      }

      const authUser = data.user;
      const storedName =
        authUser.user_metadata?.full_name ??
        authUser.user_metadata?.name ??
        "";

      let addresses: Address[] = [];

      try {
        const stored = localStorage.getItem(
          `${ADDRESS_STORAGE_KEY}:${authUser.id}`
        );
        if (stored) addresses = JSON.parse(stored) as Address[];
      } catch {
        addresses = [];
      }

      setUser({
        id: authUser.id,
        name: storedName,
        email: authUser.email ?? "",
        phone: authUser.user_metadata?.phone ?? "",
        role: getUserRole(authUser.app_metadata),
        addresses,
      });

      setAuthReady(true);
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

  const authUser = session.user;

  setUser((currentUser) => ({
    id: authUser.id,
    name:
      authUser.user_metadata?.full_name ??
      authUser.user_metadata?.name ??
      currentUser?.name ??
      "",
    email: authUser.email ?? "",
    phone: authUser.user_metadata?.phone ?? currentUser?.phone ?? "",
    role: getUserRole(authUser.app_metadata),
    addresses:
      currentUser?.id === authUser.id
        ? currentUser.addresses
        : [],
  }));

  setAuthReady(true);
});

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [supabase]);

  const login = useCallback(
    async (email: string): Promise<boolean> => {
      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        toast({
          type: "error",
          title: "Unable to Send Code",
          message: error.message,
        });
        return false;
      }

      toast({
        type: "success",
        title: "Check Your Email",
        message: "We sent you a verification code.",
      });

      return true;
    },
    [supabase, toast]
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      phone: string
    ): Promise<boolean> => {
      const normalizedEmail = email.trim().toLowerCase();

      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: true,
          data: {
            full_name: name.trim(),
            phone: phone.trim(),
          },
        },
      });

      if (error) {
        toast({
          type: "error",
          title: "Registration Failed",
          message: error.message,
        });
        return false;
      }

      toast({
        type: "success",
        title: "Verify Your Email",
        message: "We sent you a verification code.",
      });

      return true;
    },
    [supabase, toast]
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

      const authUser = data.user;

      setUser((currentUser) => ({
  id: authUser.id,
  name:
    authUser.user_metadata?.full_name ??
    authUser.user_metadata?.name ??
    currentUser?.name ??
    "",
  email: authUser.email ?? "",
  phone: authUser.user_metadata?.phone ?? currentUser?.phone ?? "",
  role: getUserRole(authUser.app_metadata),
  addresses:
    currentUser?.id === authUser.id
      ? currentUser.addresses
      : [],
}));

      toast({
        type: "success",
        title: "Email Verified",
        message: "You are now signed in.",
      });

      return true;
    },
    [supabase, toast]
  );

  const logout = useCallback(async () => {
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
  }, [supabase, saveUser, toast]);

  const persistAddresses = useCallback(
    (updated: User) => {
      saveUser(updated);

      try {
        localStorage.setItem(
          `${ADDRESS_STORAGE_KEY}:${updated.id}`,
          JSON.stringify(updated.addresses)
        );
      } catch {
        toast({
          type: "error",
          title: "Address Not Saved",
          message: "Your browser could not save this address.",
        });
      }
    },
    [saveUser, toast]
  );

  const setRole = useCallback(
    (role: "customer" | "seller" | "admin") => {
      if (role !== "customer") {
        toast({
          type: "error",
          title: "Permission Denied",
          message: "Staff roles must be assigned securely by an administrator.",
        });
      }
    },
    [toast]
  );

  const addAddress = useCallback(
    (newAddress: Omit<Address, "id">) => {
      if (!user) return;

      const address: Address = {
        ...newAddress,
        id: crypto.randomUUID(),
      };

      const existing = user.addresses.map((item) =>
        address.isDefault ? { ...item, isDefault: false } : item
      );

      const updated = {
        ...user,
        addresses: [...existing, address],
      };

      persistAddresses(updated);

      toast({
        type: "success",
        title: "Address Saved",
        message: `${address.city}, ${address.pinCode}`,
      });
    },
    [user, persistAddresses, toast]
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
    [user, persistAddresses]
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
    [user, persistAddresses, toast]
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
    [user, persistAddresses]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: authReady && !!user,
        login,
        register,
        verifyOtp,
        logout,
        setRole,
        addAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
      }}
    >
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
