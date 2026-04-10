import React, { createContext, useContext, useEffect, useState } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import axios from "axios";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setUser(null);
      setRole(null);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const fetchRole = async (token) => {
    try {
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setRole(res.data.role);
    } catch (error) {
      console.error("Failed to fetch role", error);
      // If the user exists in Firebase but not in Firestore 'users' collection
      if (error.response && error.response.status === 403) {
        // Option to attempt first admin init
        try {
            await axios.post(`${process.env.REACT_APP_API_URL}/init-admin`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const res = await axios.get(`${process.env.REACT_APP_API_URL}/auth/me`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRole(res.data.role);
        } catch (initErr) {
            console.error("Init admin failed", initErr);
        }
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        const token = await currentUser.getIdToken();
        await fetchRole(token);
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, role, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
