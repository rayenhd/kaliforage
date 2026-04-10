import React from "react";
import { useAuth } from "../AuthContext";
import { Navigate } from "react-router-dom";

const Login = () => {
  const { user, login } = useAuth();

  if (user) {
    return <Navigate to="/" />;
  }

  return (
    <div className="login-container">
      <h1>Kaliforage Management</h1>
      <p>Please sign in with your Google account to access the platform.</p>
      <button onClick={login} className="btn-primary">
        Sign in with Google
      </button>
    </div>
  );
};

export default Login;
