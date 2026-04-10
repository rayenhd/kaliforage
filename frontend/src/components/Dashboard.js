import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const Dashboard = () => {
  const { user, role, logout } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDemandes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      console.log("Firebase ID token (Dashboard):", token);
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/demandes`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDemandes(res.data);
    } catch (error) {
      console.error("Failed to fetch demandes", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDemandes();
  }, [fetchDemandes]);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    try {
      return format(new Date(dateString), "dd/MM/yyyy");
    } catch (e) {
      return dateString;
    }
  };

  return (
    <div className="dashboard-container">
      <header>
        <h1>Tableau de Bord - {role}</h1>
        <div className="user-info">
          <span>{user.email}</span>
          <button onClick={logout} className="btn-secondary">Déconnexion</button>
        </div>
      </header>

      <nav className="dashboard-nav">
        {role === "ADMIN" && (
          <>
            <Link to="/new" className="btn-primary">Nouvelle Demande</Link>
            <Link to="/users" className="btn-secondary">Gérer les Utilisateurs</Link>
          </>
        )}
      </nav>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <div className="table-responsive">
          <table className="demandes-table">
            <thead>
              <tr>
                <th>N°</th>
                <th>Date Demande</th>
                <th>Chantier</th>
                <th>Client</th>
                <th>Type Intervention</th>
                <th>Etat</th>
                <th>Sondage Prévu</th>
                <th>Remise Rapport</th>
                <th>Montant (€)</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {demandes.map((d) => (
                <tr key={d.id}>
                  <td>{d.id.substring(0, 5)}...</td>
                  <td>{formatDate(d.date_demande)}</td>
                  <td>{d.adresse_chantier}</td>
                  <td>{d.nom_client}</td>
                  <td>{d.type_intervention.join(", ")}</td>
                  <td>{d.etat}</td>
                  <td>{formatDate(d.date_sondage_prevue)}</td>
                  <td>{formatDate(d.date_remise_rapport_prevue)}</td>
                  <td>{d.montant_chantier}</td>
                  <td>
                    <Link to={`/edit/${d.id}`} className="btn-small">
                      {role === "ADMIN" ? "Modifier" : "Modifier (BE)"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
