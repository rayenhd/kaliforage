import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useAuth } from "../AuthContext";
import { Link } from "react-router-dom";
import { format } from "date-fns";

const ETATS = [
  "🟡 En attente",
  "🔵 Devis envoyé",
  "🟠 Devis Accepté",
  "🟣 Planifié",
  "🟢 Réalisé",
  "🔴 Refusé / abandonné",
];

const TYPES_REVENU = ["🟡 Apport d’affaires", "🔵 Location Machine", "🟣 Sondage"];
const TYPES_INTERVENTION = [
  "🟡 G1 PGC",
  "🔵 G2 AVP",
  "🟠 G2 PRO",
  "🟣 G5",
  "🟢 G0",
  "🔴 Etude d’assainissement",
  "⚫ Autre..",
];
const buildFieldConfig = (entreprises) => ({
  date_demande: { label: "Date demande", type: "date" },
  adresse_chantier: { label: "Adresse chantier", type: "textarea" },
  nom_client: { label: "Client", type: "text" },
  telephone: { label: "Téléphone", type: "text" },
  email: { label: "Email", type: "text" },
  adresse_facturation: { label: "Adresse facturation", type: "textarea" },
  type_intervention: { label: "Type intervention", type: "multiselect", options: TYPES_INTERVENTION },
  description: { label: "Description", type: "textarea" },
  etat: { label: "Etat", type: "select", options: ETATS },
  date_sondage_prevue: { label: "Date sondage prévue", type: "date" },
  date_remise_rapport_prevue: { label: "Date remise rapport", type: "date" },
  montant_chantier: { label: "Montant chantier", type: "number" },
  type_revenu: { label: "Type revenu", type: "multiselect", options: TYPES_REVENU },
  revenu: { label: "Revenu", type: "text" },
  commentaire: { label: "Commentaire", type: "textarea" },
  visibilite: { label: "Visibilité", type: "multiselect", options: entreprises },
});

const Dashboard = () => {
  const { user, role, logout } = useAuth();
  const [demandes, setDemandes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAdminFilters, setSelectedAdminFilters] = useState([]);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState("");
  const [savingCell, setSavingCell] = useState(false);
  const [cellError, setCellError] = useState("");
  const [entreprises, setEntreprises] = useState([]);
  const [newEntreprise, setNewEntreprise] = useState("");
  const [companyError, setCompanyError] = useState("");

  const fieldConfig = useMemo(() => buildFieldConfig(entreprises), [entreprises]);

  const fetchDemandes = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const token = await user.getIdToken();
      const entreprisesRes = await axios.get(`${process.env.REACT_APP_API_URL}/entreprises`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setEntreprises(
        Array.isArray(entreprisesRes.data) ? entreprisesRes.data.map((e) => e.name) : []
      );

      const res = await axios.get(`${process.env.REACT_APP_API_URL}/demandes`, {
        headers: { Authorization: `Bearer ${token}` },
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

  const toDateInputValue = (value) => {
    if (!value) return "";
    return String(value).split("T")[0];
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === "") return "-";
    const numeric = Number(value);
    if (Number.isNaN(numeric)) return value;
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(numeric);
  };

  const canEditField = useCallback(
    (field) => {
      if (role === "ADMIN") return true;
      if (!entreprises.includes(role)) return false;
      return field !== "visibilite";
    },
    [role, entreprises]
  );

  const openCellEditor = (demande, field) => {
    if (!canEditField(field)) return;

    const config = fieldConfig[field];
    if (!config) return;

    let initialValue = demande[field];
    if (config.type === "date") {
      initialValue = toDateInputValue(initialValue);
    }
    if (config.type === "multiselect") {
      initialValue = Array.isArray(initialValue) ? initialValue : initialValue ? [initialValue] : [];
    }
    if (config.type === "number") {
      initialValue = initialValue ?? "";
    }

    setCellError("");
    setEditingCell({ demandeId: demande.id, field, config });
    setEditValue(initialValue ?? "");
  };

  const closeCellEditor = () => {
    if (savingCell) return;
    setEditingCell(null);
    setEditValue("");
    setCellError("");
  };

  const toggleMultiValue = (value) => {
    setEditValue((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    });
  };

  const saveCellValue = async () => {
    if (!editingCell || !user) return;

    const { demandeId, field, config } = editingCell;
    let valueToSend = editValue;

    if (config.type === "number") {
      if (editValue === "" || editValue === null || editValue === undefined) {
        valueToSend = null;
      } else {
        valueToSend = Number(editValue);
      }
      if (valueToSend !== null && Number.isNaN(valueToSend)) {
        setCellError("Valeur numérique invalide.");
        return;
      }
    }

    if (config.type === "date") {
      valueToSend = editValue ? editValue : null;
    }

    const payload = { [field]: valueToSend };

    try {
      setSavingCell(true);
      setCellError("");
      const token = await user.getIdToken();
      const res = await axios.put(`${process.env.REACT_APP_API_URL}/demandes/${demandeId}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setDemandes((prev) => prev.map((d) => (d.id === demandeId ? res.data : d)));
      closeCellEditor();
    } catch (error) {
      setCellError(error.response?.data?.detail || "Impossible de sauvegarder cette valeur.");
    } finally {
      setSavingCell(false);
    }
  };

  const deleteDemande = async (demandeId) => {
    if (role !== "ADMIN" || !user) return;

    const shouldDelete = window.confirm("Confirmer la suppression de cette demande ?");
    if (!shouldDelete) return;

    try {
      const token = await user.getIdToken();
      await axios.delete(`${process.env.REACT_APP_API_URL}/demandes/${demandeId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setDemandes((prev) => prev.filter((d) => d.id !== demandeId));
    } catch (error) {
      const message =
        typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : "Impossible de supprimer cette demande.";
      window.alert(message);
    }
  };

  const addEntreprise = async (e) => {
    e.preventDefault();
    if (role !== "ADMIN" || !user) return;

    const name = newEntreprise.trim();
    if (!name) {
      setCompanyError("Le nom de l'entreprise est requis.");
      return;
    }

    try {
      setCompanyError("");
      const token = await user.getIdToken();
      await axios.post(
        `${process.env.REACT_APP_API_URL}/entreprises`,
        { name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewEntreprise("");
      await fetchDemandes();
    } catch (error) {
      const message =
        typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : "Impossible d'ajouter cette entreprise.";
      setCompanyError(message);
    }
  };

  const deleteEntreprise = async (name) => {
    if (role !== "ADMIN" || !user) return;
    const shouldDelete = window.confirm(`Confirmer la suppression de l'entreprise "${name}" ?`);
    if (!shouldDelete) return;

    try {
      setCompanyError("");
      const token = await user.getIdToken();
      await axios.delete(`${process.env.REACT_APP_API_URL}/entreprises/${encodeURIComponent(name)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSelectedAdminFilters((prev) => prev.filter((value) => value !== name));
      await fetchDemandes();
    } catch (error) {
      const message =
        typeof error.response?.data?.detail === "string"
          ? error.response.data.detail
          : "Impossible de supprimer cette entreprise.";
      setCompanyError(message);
    }
  };

  const toggleAdminFilter = (name) => {
    setSelectedAdminFilters((prev) =>
      prev.includes(name) ? prev.filter((value) => value !== name) : [...prev, name]
    );
  };

  const filteredDemandes = useMemo(
    () =>
      demandes.filter((d) => {
        if (role !== "ADMIN") return true;
        if (selectedAdminFilters.length === 0) return true;
        if (!Array.isArray(d.visibilite)) return false;
        return d.visibilite.some((v) => selectedAdminFilters.includes(v));
      }),
    [selectedAdminFilters, demandes, role]
  );

  const editableClass = (field) => (canEditField(field) ? "editable-cell" : "readonly-cell");

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

      {role === "ADMIN" && (
        <div className="dashboard-nav dashboard-filter-nav">
          {entreprises.map((entrepriseName) => (
            <button
              key={entrepriseName}
              onClick={() => toggleAdminFilter(entrepriseName)}
              className={selectedAdminFilters.includes(entrepriseName) ? "btn-primary" : "btn-secondary"}
            >
              {entrepriseName}
            </button>
          ))}
        </div>
      )}

      {role === "ADMIN" && (
        <section className="add-company-section">
          <h3>Ajouter une entreprise</h3>
          <form onSubmit={addEntreprise}>
            <input
              type="text"
              placeholder="Nom de l'entreprise"
              value={newEntreprise}
              onChange={(e) => setNewEntreprise(e.target.value)}
            />
            <button type="submit" className="btn-primary">Ajouter</button>
          </form>
          <div className="company-list">
            {entreprises.map((name) => (
              <div key={name} className="company-list-item">
                <span>{name}</span>
                <button type="button" className="btn-small btn-danger" onClick={() => deleteEntreprise(name)}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
          {companyError && <p className="error">{companyError}</p>}
        </section>
      )}

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
                <th>Téléphone</th>
                <th>Email</th>
                <th>Adresse Facturation</th>
                <th>Type Intervention</th>
                <th>Description</th>
                <th>Etat</th>
                <th>Sondage Prévu</th>
                <th>Remise Rapport</th>
                <th>Montant Chantier</th>
                <th>Type Revenu</th>
                <th>Revenu</th>
                <th>Commentaire</th>
                <th>Visibilité</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDemandes.length === 0 && (
                <tr>
                  <td colSpan="18" className="empty-table-cell">
                    Aucune demande pour ce filtre.
                  </td>
                </tr>
              )}
              {filteredDemandes.map((d) => (
                <tr key={d.id}>
                  <td>{d.id.substring(0, 5)}...</td>
                  <td className={editableClass("date_demande")} onClick={() => openCellEditor(d, "date_demande")}>{formatDate(d.date_demande)}</td>
                  <td className={`cell-long ${editableClass("adresse_chantier")}`} onClick={() => openCellEditor(d, "adresse_chantier")}>{d.adresse_chantier}</td>
                  <td className={editableClass("nom_client")} onClick={() => openCellEditor(d, "nom_client")}>{d.nom_client}</td>
                  <td className={editableClass("telephone")} onClick={() => openCellEditor(d, "telephone")}>{d.telephone || "-"}</td>
                  <td className={editableClass("email")} onClick={() => openCellEditor(d, "email")}>{d.email || "-"}</td>
                  <td className={`cell-long ${editableClass("adresse_facturation")}`} onClick={() => openCellEditor(d, "adresse_facturation")}>{d.adresse_facturation || "-"}</td>
                  <td className={editableClass("type_intervention")} onClick={() => openCellEditor(d, "type_intervention")}>{Array.isArray(d.type_intervention) && d.type_intervention.length > 0 ? d.type_intervention.join(", ") : "-"}</td>
                  <td className={`cell-long ${editableClass("description")}`} onClick={() => openCellEditor(d, "description")}>{d.description || "-"}</td>
                  <td className={editableClass("etat")} onClick={() => openCellEditor(d, "etat")}><span className="status-badge">{d.etat}</span></td>
                  <td className={editableClass("date_sondage_prevue")} onClick={() => openCellEditor(d, "date_sondage_prevue")}>{formatDate(d.date_sondage_prevue)}</td>
                  <td className={editableClass("date_remise_rapport_prevue")} onClick={() => openCellEditor(d, "date_remise_rapport_prevue")}>{formatDate(d.date_remise_rapport_prevue)}</td>
                  <td className={editableClass("montant_chantier")} onClick={() => openCellEditor(d, "montant_chantier")}>{formatCurrency(d.montant_chantier)}</td>
                  <td className={editableClass("type_revenu")} onClick={() => openCellEditor(d, "type_revenu")}>
                    {Array.isArray(d.type_revenu) && d.type_revenu.length > 0
                      ? d.type_revenu.join(", ")
                      : d.type_revenu || "-"}
                  </td>
                  <td className={`cell-long ${editableClass("revenu")}`} onClick={() => openCellEditor(d, "revenu")}>{d.revenu || "-"}</td>
                  <td className={`cell-long ${editableClass("commentaire")}`} onClick={() => openCellEditor(d, "commentaire")}>{d.commentaire || "-"}</td>
                  <td className={editableClass("visibilite")} onClick={() => openCellEditor(d, "visibilite")}>
                    {Array.isArray(d.visibilite) && d.visibilite.length > 0 ? (
                      <span className="visibility-badge">{d.visibilite.join(", ")}</span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="actions-cell">
                    <Link to={`/edit/${d.id}`} className="btn-small">
                      {role === "ADMIN" ? "Modifier" : "Modifier (BE)"}
                    </Link>
                    {role === "ADMIN" && (
                      <button type="button" className="btn-small btn-danger" onClick={() => deleteDemande(d.id)}>
                        Supprimer
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editingCell && (
        <div className="cell-modal-overlay" onClick={closeCellEditor}>
          <div className="cell-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier: {editingCell.config.label}</h3>

            {editingCell.config.type === "textarea" && (
              <textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} rows={5} />
            )}

            {editingCell.config.type === "text" && (
              <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            )}

            {editingCell.config.type === "number" && (
              <input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            )}

            {editingCell.config.type === "date" && (
              <input type="date" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
            )}

            {editingCell.config.type === "select" && (
              <select value={editValue} onChange={(e) => setEditValue(e.target.value)}>
                {editingCell.config.options.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            )}

            {editingCell.config.type === "multiselect" && (
              <div className="cell-modal-checkboxes">
                {editingCell.config.options.map((option) => (
                  <label key={option}>
                    {option}
                    <input
                      type="checkbox"
                      checked={Array.isArray(editValue) && editValue.includes(option)}
                      onChange={() => toggleMultiValue(option)}
                    />
                    
                  </label>
                ))}
              </div>
            )}

            {cellError && <p className="error">{cellError}</p>}

            <div className="cell-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeCellEditor} disabled={savingCell}>
                Annuler
              </button>
              <button type="button" className="btn-primary" onClick={saveCellValue} disabled={savingCell}>
                {savingCell ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
