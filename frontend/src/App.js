import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./AuthContext";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import AdminForm from "./components/AdminForm";
import UserManagement from "./components/UserManagement";
import "./App.css";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, role } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(role)) return <Navigate to="/" />;
  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="App">
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/en-attente"
              element={
                <ProtectedRoute>
                  <Dashboard categoryKey="en-attente" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/devis-envoyes"
              element={
                <ProtectedRoute>
                  <Dashboard categoryKey="devis-envoyes" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/realisees"
              element={
                <ProtectedRoute>
                  <Dashboard categoryKey="realisees" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/annules"
              element={
                <ProtectedRoute>
                  <Dashboard categoryKey="annules" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/new"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <AdminForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/edit/:id"
              element={
                <ProtectedRoute>
                  <AdminForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/users"
              element={
                <ProtectedRoute allowedRoles={["ADMIN"]}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
