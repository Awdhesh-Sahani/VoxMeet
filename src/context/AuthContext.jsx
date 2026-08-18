import { createContext, useContext, useState } from "react";
import { setToken, clearToken } from "../state/authStore";

// See state/authStore.js for the httpOnly-cookie-vs-memory decision.
// Because the token lives only in memory, a hard refresh clears auth —
// that's the accepted trade-off, not a bug.

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading] = useState(false); // nothing persisted to validate on load

  const login = (token, userData) => {
    setToken(token);
    setUser(userData);
  };

  const logout = () => {
    clearToken();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
