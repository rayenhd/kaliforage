import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

const Templates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTemplate, setNewTemplate] = useState({ title: "", content: "" });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await axios.get(`${process.env.REACT_APP_API_URL}/mail-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates(res.data);
    } catch (err) {
      console.error("Fetch templates error", err);
      setError("Impossible de charger les templates.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError("");
    if (!newTemplate.title.trim() || !newTemplate.content.trim()) {
      setError("Le titre et le contenu sont requis.");
      return;
    }
    try {
      setCreating(true);
      const token = await user.getIdToken();
      await axios.post(
        `${process.env.REACT_APP_API_URL}/mail-templates`,
        { title: newTemplate.title, content: newTemplate.content },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setNewTemplate({ title: "", content: "" });
      await fetchTemplates();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Impossible de créer ce template.");
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id, title) => {
    if (!window.confirm(`Supprimer le template "${title}" ?`)) return;
    try {
      const token = await user.getIdToken();
      await axios.delete(`${process.env.REACT_APP_API_URL}/mail-templates/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      if (selected?.id === id) closeModal();
    } catch (err) {
      console.error("Delete template error", err);
    }
  };

  const openModal = (template) => {
    setSelected(template);
    setCopied(false);
  };

  const closeModal = () => {
    setSelected(null);
    setCopied(false);
  };

  const handleCopy = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textarea = document.createElement("textarea");
      textarea.value = selected.content;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e) {
        console.error("Copy failed", e);
      }
      document.body.removeChild(textarea);
    }
  };

  return (
    <div className="user-mgmt-container">
      <header>
        <h2>Templates de mail</h2>
        <Link to="/" className="btn-secondary">Retour au Tableau de Bord</Link>
      </header>

      <section className="add-user-section">
        <h3>Créer un nouveau template</h3>
        <form onSubmit={handleCreate} className="template-form">
          <input
            type="text"
            placeholder="Titre du template"
            value={newTemplate.title}
            onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
          />
          <textarea
            placeholder="Contenu du mail..."
            rows={8}
            value={newTemplate.content}
            onChange={(e) => setNewTemplate({ ...newTemplate, content: e.target.value })}
          />
          <button type="submit" className="btn-primary" disabled={creating}>
            {creating ? "Création..." : "Créer le template"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}
      </section>

      <section>
        <h3>Templates existants</h3>
        {loading ? (
          <p>Chargement...</p>
        ) : templates.length === 0 ? (
          <p>Aucun template pour l'instant.</p>
        ) : (
          <div className="template-list">
            {templates.map((t) => (
              <div key={t.id} className="template-card" onClick={() => openModal(t)}>
                <div className="template-card-title">{t.title}</div>
                <div className="template-card-preview">
                  {t.content.length > 120 ? `${t.content.slice(0, 120)}...` : t.content}
                </div>
                <div className="template-card-actions">
                  <button
                    type="button"
                    className="btn-small btn-danger"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(t.id, t.title);
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {selected && (
        <div className="cell-modal-overlay" onClick={closeModal}>
          <div className="cell-modal" onClick={(e) => e.stopPropagation()}>
            <h3>{selected.title}</h3>
            <textarea
              value={selected.content}
              readOnly
              rows={12}
              className="template-content-view"
            />
            <div className="cell-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Fermer
              </button>
              <button type="button" className="btn-primary" onClick={handleCopy}>
                {copied ? "Copié !" : "Copier le texte"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
