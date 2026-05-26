import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { useAuth } from "../AuthContext";

const stripHtml = (html) => {
  if (!html) return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const ensureHtml = (content) => {
  if (!content) return "";
  if (!/<\w+/.test(content)) {
    return content.replace(/\n/g, "<br>");
  }
  return content;
};

const isHtmlEmpty = (html) => stripHtml(html).trim().length === 0;

const RichTextEditor = ({ value, onChange, placeholder = "", ariaLabel = "Éditeur" }) => {
  const editorRef = useRef(null);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false });
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    if (el.innerHTML !== (value || "")) {
      el.innerHTML = value || "";
    }
    setIsEmpty(isHtmlEmpty(el.innerHTML));
  }, [value]);

  const refreshActive = () => {
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
      });
    } catch (e) {
      // queryCommandState can throw if no selection
    }
  };

  const apply = (cmd) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false);
    refreshActive();
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
      setIsEmpty(isHtmlEmpty(editorRef.current.innerHTML));
    }
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    onChange(editorRef.current.innerHTML);
    setIsEmpty(isHtmlEmpty(editorRef.current.innerHTML));
    refreshActive();
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
  };

  const handleKeyDown = (e) => {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === "b" || e.key === "B")) {
      e.preventDefault();
      apply("bold");
    } else if (mod && (e.key === "i" || e.key === "I")) {
      e.preventDefault();
      apply("italic");
    } else if (mod && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      apply("underline");
    }
  };

  return (
    <div className="rte">
      <div className="rte-toolbar" role="toolbar" aria-label="Mise en forme">
        <button
          type="button"
          className={`rte-btn ${active.bold ? "is-active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); apply("bold"); }}
          aria-label="Gras"
          title="Gras (Ctrl/⌘+B)"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`rte-btn ${active.italic ? "is-active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); apply("italic"); }}
          aria-label="Italique"
          title="Italique (Ctrl/⌘+I)"
        >
          <em>I</em>
        </button>
        <button
          type="button"
          className={`rte-btn ${active.underline ? "is-active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); apply("underline"); }}
          aria-label="Souligné"
          title="Souligné (Ctrl/⌘+U)"
        >
          <span className="rte-btn-u">U</span>
        </button>
      </div>
      <div
        ref={editorRef}
        className={`rte-content ${isEmpty ? "is-empty" : ""}`}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        data-placeholder={placeholder}
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
      />
    </div>
  );
};

const Templates = () => {
  const { user } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newTemplate, setNewTemplate] = useState({ title: "", content: "" });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
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
    if (!newTemplate.title.trim() || isHtmlEmpty(newTemplate.content)) {
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

  const isDirty = useMemo(() => {
    if (!selected) return false;
    const originalHtml = ensureHtml(selected.content || "");
    return editTitle !== (selected.title || "") || editContent !== originalHtml;
  }, [selected, editTitle, editContent]);

  const canSave = isDirty && editTitle.trim().length > 0 && !isHtmlEmpty(editContent);

  const openModal = (template) => {
    setSelected(template);
    setEditTitle(template.title || "");
    setEditContent(ensureHtml(template.content || ""));
    setSaveError("");
    setCopied(false);
  };

  const closeModal = () => {
    if (isDirty) {
      const ok = window.confirm("Des modifications non enregistrées seront perdues. Fermer quand même ?");
      if (!ok) return;
    }
    setSelected(null);
    setEditTitle("");
    setEditContent("");
    setSaveError("");
    setCopied(false);
  };

  const handleSave = async () => {
    if (!selected || !canSave) return;
    setSaving(true);
    setSaveError("");
    try {
      const token = await user.getIdToken();
      const res = await axios.put(
        `${process.env.REACT_APP_API_URL}/mail-templates/${selected.id}`,
        { title: editTitle.trim(), content: editContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTemplates((prev) => prev.map((t) => (t.id === selected.id ? res.data : t)));
      setSelected(res.data);
      setEditTitle(res.data.title || "");
      setEditContent(ensureHtml(res.data.content || ""));
    } catch (err) {
      const detail = err.response?.data?.detail;
      setSaveError(typeof detail === "string" ? detail : "Impossible d'enregistrer ce template.");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    if (!selected) return;
    const html = ensureHtml(selected.content || "");
    const text = stripHtml(html);
    try {
      if (typeof window !== "undefined" && window.ClipboardItem) {
        const item = new window.ClipboardItem({
          "text/html": new Blob([html], { type: "text/html" }),
          "text/plain": new Blob([text], { type: "text/plain" }),
        });
        await navigator.clipboard.write([item]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (e2) {
        console.error("Copy failed", e2);
      }
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
          <RichTextEditor
            value={newTemplate.content}
            onChange={(html) => setNewTemplate((prev) => ({ ...prev, content: html }))}
            placeholder="Contenu du mail..."
            ariaLabel="Contenu du template"
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
            {templates.map((t) => {
              const preview = stripHtml(t.content || "");
              return (
                <div key={t.id} className="template-card" onClick={() => openModal(t)}>
                  <div className="template-card-title">{t.title}</div>
                  <div className="template-card-preview">
                    {preview.length > 120 ? `${preview.slice(0, 120)}...` : preview}
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
              );
            })}
          </div>
        )}
      </section>

      {selected && (
        <div className="cell-modal-overlay" onClick={closeModal}>
          <div className="cell-modal cell-modal--lg" onClick={(e) => e.stopPropagation()}>
            <h3>Modifier le template</h3>
            <input
              type="text"
              className="template-edit-title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Titre du template"
            />
            <RichTextEditor
              value={editContent}
              onChange={setEditContent}
              placeholder="Contenu du mail..."
              ariaLabel="Contenu du template"
            />
            {saveError && <p className="error">{saveError}</p>}
            {isDirty && !saveError && (
              <p className="template-dirty-hint">Modifications non enregistrées</p>
            )}
            <div className="cell-modal-actions">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Fermer
              </button>
              <button type="button" className="btn-secondary" onClick={handleCopy}>
                {copied ? "Copié !" : "Copier le texte"}
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={handleSave}
                disabled={!canSave || saving}
              >
                {saving ? "Enregistrement..." : "Sauvegarder"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Templates;
