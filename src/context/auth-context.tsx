"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { User, Address } from "@/types";
import { DEMO_USER } from "@/data/mock-data";
import { useToast } from "./toast-context";

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string) => Promise<boolean>;
  register: (name: string, email: string, phone: string) => Promise<boolean>;
  logout: () => void;
  setRole: (role: "customer" | "seller" | "admin") => void;
  addAddress: (address: Omit<Address, "id">) => void;
  updateAddress: (id: string, address: Partial<Address>) => void;
  deleteAddress: (id: string) => void;
  setDefaultAddress: (id: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const USER_STORAGE_KEY = "rnl_auth_user_v1";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(DEMO_USER);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(USER_STORAGE_KEY);
      if (stored) {
        setUser(JSON.parse(stored));
      } else {
        setUser(DEMO_USER);
      }
    } catch {
      setUser(DEMO_USER);
    }
  }, []);

  const saveUser = useCallback((updated: User | null) => {
    setUser(updated);
    try {
      if (updated) {
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
      } else {
        localStorage.removeItem(USER_STORAGE_KEY);
      }
    } catch {
      // Ignore
    }
  }, []);

  const login = useCallback(
    async (email: string): Promise<boolean> => {
      const simulated: User = {
        ...DEMO_USER,
        email: email || DEMO_USER.email,
      };
      saveUser(simulated);
      toast({
        type: "success",
        title: "Signed In (Demo)",
        message: `Welcome back, ${simulated.name}`,
      });
      return true;
    },
    [saveUser, toast]
  );

  const register = useCallback(
    async (name: string, email: string, phone: string): Promise<boolean> => {
      const newUser: User = {
        id: `usr-${Date.now()}`,
        name,
        email,
        phone,
        role: "customer",
        addresses: [],
      };
      saveUser(newUser);
      toast({
        type: "success",
        title: "Account Created (Demo)",
        message: `Welcome to RightNowLife, ${name}`,
      });
      return true;
    },
    [saveUser, toast]
  );

  const logout = useCallback(() => {
    saveUser(null);
    toast({
      type: "info",
      title: "Signed Out",
      message: "You have been logged out of your session.",
    });
  }, [saveUser, toast]);

  const setRole = useCallback(
    (role: "customer" | "seller" | "admin") => {
      if (!user) return;
      const updated: User = { ...user, role };
      saveUser(updated);
      toast({
        type: "info",
        title: `Switched to ${role.toUpperCase()} View`,
        message: `Active demo perspective changed to ${role}`,
      });
    },
    [user, saveUser, toast]
  );

  const addAddress = useCallback(
    (newAddr: Omit<Address, "id">) => {
      if (!user) return;
      const id = `addr-${Date.now()}`;
      const address: Address = { ...newAddr, id };
      const addresses = user.addresses.map((a) =>
        newAddr.isDefault ? { ...a, isDefault: false } : a
      );
      const updated: User = {
        ...user,
        addresses: [...addresses, address],
      };
      saveUser(updated);
      toast({
        type: "success",
        title: "Address Saved",
        message: `${address.city}, ${address.pinCode}`,
      });
    },
    [user, saveUser, toast]
  );

  const updateAddress = useCallback(
    (id: string, fields: Partial<Address>) => {
      if (!user) return;
      const updatedAddresses = user.addresses.map((a) => {
        if (a.id === id) {
          return { ...a, ...fields };
        }
        if (fields.isDefault) {
          return { ...a, isDefault: false };
        }
        return a;
      });
      saveUser({ ...user, addresses: updatedAddresses });
      toast({
        type: "success",
        title: "Address Updated",
      });
    },
    [user, saveUser, toast]
  );

  const deleteAddress = useCallback(
    (id: string) => {
      if (!user) return;
      const filtered = user.addresses.filter((a) => a.id !== id);
      saveUser({ ...user, addresses: filtered });
      toast({
        type: "info",
        title: "Address Deleted",
      });
    },
    [user, saveUser, toast]
  );

  const setDefaultAddress = useCallback(
    (id: string) => {
      if (!user) return;
      const updated = user.addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }));
      saveUser({ ...user, addresses: updated });
      toast({
        type: "success",
        title: "Default Address Updated",
      });
    },
    [user, saveUser, toast]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
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
