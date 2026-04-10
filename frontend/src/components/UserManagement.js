import React, { useState, useEffect } from "react";
import axios from "axios";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";

const ROLES = ["ADMIN", "FONDASOLUTION", "KALIFORAGE INGENIERIE"];

const UserManagement = () => {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ email: "", role: ROLES[1] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchUsers = async () => {
    try {
      const token = await user.getIdToken();
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/users`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUsers(res.data);
    } catch (err) {
      console.error("Fetch users error", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [user]);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const token = await user.getIdToken();
      await axios.post(`${process.env.REACT_APP_API_URL}/users`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUser({ email: "", role: ROLES[1] });
      fetchUsers();
    } catch (err) {
      setError("Failed to add user");
    }
  };

  const handleDeleteUser = async (email) => {
    if (!window.confirm(`Delete user ${email}?`)) return;
    try {
      const token = await user.getIdToken();
      await axios.delete(`${process.env.REACT_APP_API_URL}/users/${email}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchUsers();
    } catch (err) {
      console.error("Delete user error", err);
    }
  };

  return (
    <div className="user-mgmt-container">
      <header>
        <h2>Gestion des Utilisateurs</h2>
        <Link to="/" className="btn-secondary">Retour au Tableau de Bord</Link>
      </header>

      <section className="add-user-section">
        <h3>Ajouter un Utilisateur</h3>
        <form onSubmit={handleAddUser}>
          <input 
            type="email" placeholder="Email Google" 
            value={newUser.email} onChange={(e) => setNewUser({...newUser, email: e.target.value})}
            required
          />
          <select 
            value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value})}
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button type="submit" className="btn-primary">Ajouter</button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      {loading ? <p>Chargement...</p> : (
        <table className="users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Rôle</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u.email}>
                <td>{u.email}</td>
                <td>{u.role}</td>
                <td>
                  <button 
                    onClick={() => handleDeleteUser(u.email)} 
                    className="btn-danger"
                    disabled={u.email === user.email}
                  >
                    Supprimer
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default UserManagement;
