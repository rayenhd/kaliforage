import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

const ETATS = [
  "🟡 En attente",
  "🔵 Devis envoyé",
  "🟠 Devis Accepté",
  "🟣 Planifié",
  "🟢 Réalisé",
  "🔴 Refusé / abandonné",
];

const TYPES_REVENU = [
  "🟡 Apport d’affaires",
  "🔵 Location Machine",
];

const TYPES_INTERVENTION = [
  "🟡 G1 PGC",
  "🔵 G2 AVP",
  "🟠 G2 PRO",
  "🟣 G5",
  "🟢 G0",
  "🔴 Etude d’assainissement",
  "⚫ Autre..",
];

const VISIBILITES = ["FONDASOLUTION", "KALIFORAGE INGENIERIE"];

const AdminForm = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const isAdmin = role === "ADMIN";

  const [formData, setFormData] = useState({
    date_demande: new Date().toISOString().split("T")[0],
    adresse_chantier: "",
    nom_client: "",
    telephone: "",
    email: "",
    adresse_facturation: "",
    type_intervention: [],
    description: "",
    etat: ETATS[0],
    date_sondage_prevue: "",
    date_remise_rapport_prevue: "",
    montant_chantier: 0,
    type_revenu: TYPES_REVENU[0],
    revenu: 0,
    commentaire: "",
    visibilite: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (id) {
      const fetchDemande = async () => {
        try {
          const token = await user.getIdToken();
          const res = await axios.get(`${process.env.REACT_APP_API_URL}/demandes`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          const current = res.data.find(d => d.id === id);
          if (current) {
            // Format dates for input[type=date]
            const formatted = {
              ...current,
              date_demande: current.date_demande ? current.date_demande.split("T")[0] : "",
              date_sondage_prevue: current.date_sondage_prevue ? current.date_sondage_prevue.split("T")[0] : "",
              date_remise_rapport_prevue: current.date_remise_rapport_prevue ? current.date_remise_rapport_prevue.split("T")[0] : "",
            };
            setFormData(formatted);
          }
        } catch (error) {
          console.error("Fetch demande error", error);
        }
      };
      fetchDemande();
    }
  }, [id, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name, value) => {
    setFormData((prev) => {
      const currentValues = prev[name];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [name]: newValues };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      if (id) {
        // Update
        const payload = isAdmin ? formData : {
            etat: formData.etat,
            date_sondage_prevue: formData.date_sondage_prevue,
            date_remise_rapport_prevue: formData.date_remise_rapport_prevue,
            montant_chantier: formData.montant_chantier,
            commentaire: formData.commentaire,
        };
        await axios.put(`${process.env.REACT_APP_API_URL}/demandes/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create (Admin only)
        await axios.post(`${process.env.REACT_APP_API_URL}/demandes`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.detail || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-container">
      <h2>{id ? "Modifier la Demande" : "Nouvelle Demande"}</h2>
      {error && <p className="error">{error}</p>}
      
      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <section className="form-section">
            <h3>Informations Générales</h3>
            
            <label>Date de demande:</label>
            <input 
                type="date" name="date_demande" 
                value={formData.date_demande} onChange={handleChange} 
                disabled={!isAdmin} required 
            />

            <label>Adresse du chantier:</label>
            <input 
                type="text" name="adresse_chantier" 
                value={formData.adresse_chantier} onChange={handleChange} 
                disabled={!isAdmin} required 
            />

            <label>Nom du client:</label>
            <input 
                type="text" name="nom_client" 
                value={formData.nom_client} onChange={handleChange} 
                disabled={!isAdmin} required 
            />

            <label>Téléphone:</label>
            <input 
                type="text" name="telephone" 
                value={formData.telephone} onChange={handleChange} 
                disabled={!isAdmin} required 
            />

            <label>Email:</label>
            <input 
                type="email" name="email" 
                value={formData.email} onChange={handleChange} 
                disabled={!isAdmin} required 
            />

            <label>Adresse de facturation:</label>
            <textarea 
                name="adresse_facturation" 
                value={formData.adresse_facturation} onChange={handleChange} 
                disabled={!isAdmin} required 
            />
          </section>

          <section className="form-section">
            <h3>Intervention & Revenu</h3>
            
            <label>Type d’intervention:</label>
            <div className="checkbox-group">
              {TYPES_INTERVENTION.map(type => (
                <label key={type}>
                  <input 
                    type="checkbox" 
                    checked={formData.type_intervention.includes(type)}
                    onChange={() => handleCheckboxChange("type_intervention", type)}
                    disabled={!isAdmin}
                  /> {type}
                </label>
              ))}
            </div>

            <label>Description / Détails:</label>
            <textarea 
                name="description" 
                value={formData.description} onChange={handleChange} 
                disabled={!isAdmin} 
            />

            <label>Type de revenu:</label>
            <select name="type_revenu" value={formData.type_revenu} onChange={handleChange} disabled={!isAdmin}>
              {TYPES_REVENU.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            <label>Revenu (€):</label>
            <input 
                type="number" name="revenu" 
                value={formData.revenu} onChange={handleChange} 
                disabled={!isAdmin} 
            />
          </section>

          <section className="form-section">
            <h3>Suivi & Planification</h3>
            
            <label>Etat de la demande:</label>
            <select name="etat" value={formData.etat} onChange={handleChange}>
              {ETATS.map(e => <option key={e} value={e}>{e}</option>)}
            </select>

            <label>Date de sondage prévue:</label>
            <input 
                type="date" name="date_sondage_prevue" 
                value={formData.date_sondage_prevue} onChange={handleChange} 
            />

            <label>Date de remise rapport prévue:</label>
            <input 
                type="date" name="date_remise_rapport_prevue" 
                value={formData.date_remise_rapport_prevue} onChange={handleChange} 
            />

            <label>Montant du chantier (€):</label>
            <input 
                type="number" name="montant_chantier" 
                value={formData.montant_chantier} onChange={handleChange} 
            />

            <label>Commentaire / suivi:</label>
            <textarea 
                name="commentaire" 
                value={formData.commentaire} onChange={handleChange} 
            />
          </section>

          {isAdmin && (
            <section className="form-section">
              <h3>Visibilité</h3>
              <p>Qui peut voir ces infos ?</p>
              <div className="checkbox-group">
                {VISIBILITES.map(v => (
                  <label key={v}>
                    <input 
                      type="checkbox" 
                      checked={formData.visibilite.includes(v)}
                      onChange={() => handleCheckboxChange("visibilite", v)}
                    /> {v}
                  </label>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="form-actions">
          <Link to="/" className="btn-secondary">Annuler</Link>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? "Enregistrement..." : "Enregistrer"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminForm;
