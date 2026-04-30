import React, { useState, useEffect } from "react";
import axios from "axios";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../AuthContext";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "../firebase";

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
  "🟣 Sondage",
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

const EMAIL_LABELS = [
  ["vous_etes", /^vous\s*[ée]tes\s*:?\s*(.*)$/i],
  ["prenom", /^pr[ée]nom\s*:?\s*(.*)$/i],
  ["nom", /^nom\s*:?\s*(.*)$/i],
  ["adresse_personnel", /^adresse\s+personnel(?:le)?\s*:?\s*(.*)$/i],
  ["email", /^e?-?mail\s*:?\s*(.*)$/i],
  ["telephone", /^t[ée]l[ée]phone\s*:?\s*(.*)$/i],
  ["adresse_parcelle", /^adresse\s+parcelle\s*:?\s*(.*)$/i],
  ["ville", /^ville\s*:?\s*(.*)$/i],
  ["code_postal", /^code\s+postale?\s*:?\s*(.*)$/i],
  ["section_cadastrale", /^section\s+cadastrale.*?:?\s*(.*)$/i],
  ["numero_cadastrale", /^n[°o]?\s*cadastrale.*?:?\s*(.*)$/i],
  ["superficie", /^superficie.*m2\s*:?\s*(.*)$/i],
  ["message", /^message\s*:?\s*(.*)$/i],
];

const EMAIL_STOP_PATTERNS = [
  /^j['']accepte/i,
  /^charger un fichier/i,
  /^formulaire personnalis/i,
  /^r[ée]pondez directement/i,
  /^voir toutes vos r[ée]ponses/i,
];

const parseEmailContent = (text) => {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const result = {};
  let currentKey = null;
  let buffer = [];

  const flush = () => {
    if (currentKey && buffer.length > 0) {
      const value = buffer.join(" ").trim();
      result[currentKey] = result[currentKey]
        ? `${result[currentKey]} ${value}`.trim()
        : value;
    }
    buffer = [];
  };

  for (const line of lines) {
    if (EMAIL_STOP_PATTERNS.some((p) => p.test(line))) {
      flush();
      currentKey = null;
      continue;
    }

    let matched = false;
    for (const [key, regex] of EMAIL_LABELS) {
      const m = line.match(regex);
      if (m) {
        flush();
        currentKey = key;
        const inline = m[1] ? m[1].trim() : "";
        if (inline) buffer.push(inline);
        matched = true;
        break;
      }
    }

    if (!matched && currentKey) {
      buffer.push(line);
    }
  }
  flush();
  return result;
};

const mapEmailToForm = (parsed) => {
  const nomClient = [parsed.prenom, parsed.nom].filter(Boolean).join(" ").trim();

  const adresseChantier = [
    parsed.adresse_parcelle,
    parsed.ville,
    parsed.code_postal,
  ]
    .filter(Boolean)
    .join(", ");

  const commentaireParts = [];
  if (parsed.section_cadastrale)
    commentaireParts.push(`Section cadastrale: ${parsed.section_cadastrale}`);
  if (parsed.numero_cadastrale)
    commentaireParts.push(`N° cadastrale: ${parsed.numero_cadastrale}`);
  if (parsed.superficie)
    commentaireParts.push(`Superficie: ${parsed.superficie} m²`);

  return {
    nom_client: nomClient,
    email: parsed.email || "",
    telephone: parsed.telephone || "",
    adresse_facturation: parsed.adresse_personnel || "",
    adresse_chantier: adresseChantier,
    description: parsed.message || "",
    commentaire: commentaireParts.join("\n"),
  };
};

const formatApiError = (err) => {
  const detail = err?.response?.data?.detail;

  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const lines = detail
      .map((item) => {
        if (typeof item === "string") {
          return item;
        }
        if (item && typeof item === "object") {
          const field = Array.isArray(item.loc) ? item.loc.join(".") : "champ inconnu";
          const message = item.msg || "valeur invalide";
          return `${field}: ${message}`;
        }
        return null;
      })
      .filter(Boolean);
    if (lines.length > 0) {
      return lines.join(" | ");
    }
  }

  if (detail && typeof detail === "object") {
    return detail.msg || JSON.stringify(detail);
  }

  return "Impossible d'enregistrer la demande. Vérifiez les champs et réessayez.";
};

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
    type_revenu: [],
    revenu: "",
    commentaire: "",
    visibilite: [],
    file_url: null,
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [entreprises, setEntreprises] = useState([]);
  const [creationStep, setCreationStep] = useState(id ? "form" : "choice");
  const [emailText, setEmailText] = useState("");
  const [importNotice, setImportNotice] = useState("");

  useEffect(() => {
    if (!user) return;

    const fetchFormData = async () => {
      try {
        const token = await user.getIdToken();
        const entreprisesRes = await axios.get(`${process.env.REACT_APP_API_URL}/entreprises`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setEntreprises(Array.isArray(entreprisesRes.data) ? entreprisesRes.data.map((e) => e.name) : []);

        if (id) {
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
              type_revenu: Array.isArray(current.type_revenu)
                ? current.type_revenu
                : current.type_revenu
                  ? [current.type_revenu]
                  : [],
              revenu: current.revenu ?? "",
              file_url: current.file_url ?? null,
            };
            setFormData(formatted);
          }
        }
      } catch (fetchError) {
        console.error("Fetch form data error", fetchError);
      }
    };

    fetchFormData();
  }, [id, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (name, value) => {
    setFormData((prev) => {
      const currentRaw = prev[name];
      const currentValues = Array.isArray(currentRaw) ? currentRaw : currentRaw ? [currentRaw] : [];
      const newValues = currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value];
      return { ...prev, [name]: newValues };
    });
  };

  const handleImportEmail = () => {
    const parsed = parseEmailContent(emailText);
    const mapped = mapEmailToForm(parsed);
    const filledKeys = Object.entries(mapped)
      .filter(([, v]) => v && String(v).trim().length > 0)
      .map(([k]) => k);

    if (filledKeys.length === 0) {
      setImportNotice(
        "Aucun champ détecté. Vérifiez que vous avez bien collé le contenu du mail."
      );
      return;
    }

    setFormData((prev) => ({ ...prev, ...mapped }));
    setImportNotice(
      `${filledKeys.length} champ(s) pré-rempli(s) — vérifiez et complétez avant d'enregistrer.`
    );
    setCreationStep("form");
  };

  const handleFileChange = (e) => {
    if (e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      let fileUrl = formData.file_url;

      if (selectedFile) {
        const folder = id || `temp_${Date.now()}`;
        const fileRef = ref(storage, `demandes/${folder}/${selectedFile.name}`);
        const snapshot = await uploadBytes(fileRef, selectedFile);
        fileUrl = await getDownloadURL(snapshot.ref);
      }

      const normalizedPayload = {
        ...formData,
        date_demande: formData.date_demande || null,
        date_sondage_prevue: formData.date_sondage_prevue || null,
        date_remise_rapport_prevue: formData.date_remise_rapport_prevue || null,
        revenu: formData.revenu ? String(formData.revenu).trim() : null,
        file_url: fileUrl,
      };

      if (id) {
        // Update
        const payload = isAdmin ? normalizedPayload : {
            etat: formData.etat,
            date_sondage_prevue: normalizedPayload.date_sondage_prevue,
            date_remise_rapport_prevue: normalizedPayload.date_remise_rapport_prevue,
            montant_chantier: formData.montant_chantier,
            commentaire: formData.commentaire,
            file_url: fileUrl,
        };
        await axios.put(`${process.env.REACT_APP_API_URL}/demandes/${id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        // Create (Admin only)
        await axios.post(`${process.env.REACT_APP_API_URL}/demandes`, normalizedPayload, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      navigate("/");
    } catch (err) {
      setError(formatApiError(err));
    } finally {
      setLoading(false);
    }
  };

  if (!id && creationStep === "choice") {
    return (
      <div className="form-container">
        <h2>Nouvelle Demande</h2>
        <p>Comment souhaitez-vous saisir cette demande ?</p>
        <div className="creation-choice">
          <button
            type="button"
            className="btn-primary"
            onClick={() => setCreationStep("form")}
          >
            Saisir les champs à la main
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setCreationStep("paste")}
          >
            Importer depuis un mail
          </button>
        </div>
        <div className="form-actions">
          <Link to="/" className="btn-secondary">Annuler</Link>
        </div>
      </div>
    );
  }

  if (!id && creationStep === "paste") {
    return (
      <div className="form-container">
        <h2>Importer depuis un mail</h2>
        <p>
          Collez ci-dessous le contenu du mail reçu. Les champs reconnus seront
          pré-remplis dans le formulaire — vous pourrez ensuite les compléter ou
          les corriger avant d'enregistrer.
        </p>
        {importNotice && <p className="error">{importNotice}</p>}
        <textarea
          className="email-paste-area"
          rows={18}
          value={emailText}
          onChange={(e) => setEmailText(e.target.value)}
          placeholder="Collez ici le contenu complet du mail..."
        />
        <div className="form-actions">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => {
              setCreationStep("choice");
              setImportNotice("");
            }}
          >
            Retour
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleImportEmail}
            disabled={!emailText.trim()}
          >
            Pré-remplir le formulaire
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="form-container">
      <h2>{id ? "Modifier la Demande" : "Nouvelle Demande"}</h2>
      {error && <p className="error">{error}</p>}
      {importNotice && !error && <p className="info-notice">{importNotice}</p>}

      <form onSubmit={handleSubmit}>
        <div className="form-grid">
          <section className="form-section">
            <h3>Informations Générales</h3>
            
            <label>Date de demande:</label>
            <input 
                type="date" name="date_demande" 
                value={formData.date_demande} onChange={handleChange} 
                disabled={!isAdmin}
            />

            <label>Adresse du chantier:</label>
            <input 
                type="text" name="adresse_chantier" 
                value={formData.adresse_chantier} onChange={handleChange} 
                disabled={!isAdmin}
            />

            <label>Nom du client:</label>
            <input 
                type="text" name="nom_client" 
                value={formData.nom_client} onChange={handleChange} 
                disabled={!isAdmin}
            />

            <label>Téléphone:</label>
            <input 
                type="text" name="telephone" 
                value={formData.telephone} onChange={handleChange} 
                disabled={!isAdmin}
            />

            <label>Email:</label>
            <input 
                type="email" name="email" 
                value={formData.email} onChange={handleChange} 
                disabled={!isAdmin}
            />

            <label>Adresse de facturation:</label>
            <textarea 
                name="adresse_facturation" 
                value={formData.adresse_facturation} onChange={handleChange} 
                disabled={!isAdmin}
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
                    checked={Array.isArray(formData.type_intervention) && formData.type_intervention.includes(type)}
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
            <div className="checkbox-group">
              {TYPES_REVENU.map(type => (
                <label key={type}>
                  <input 
                    type="checkbox" 
                    checked={Array.isArray(formData.type_revenu) && formData.type_revenu.includes(type)}
                    onChange={() => handleCheckboxChange("type_revenu", type)}
                    disabled={!isAdmin}
                  /> {type}
                </label>
              ))}
            </div>

            <label>Revenu (chiffres/lettres):</label>
            <input 
                type="text" name="revenu" 
                value={formData.revenu} onChange={handleChange} 
                placeholder="Ex: 1500 / mille cinq cents"
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

            <label>Fichier / Document:</label>
            <input type="file" onChange={handleFileChange} />
            {formData.file_url && (
              <p className="file-link">
                Fichier actuel: <a href={formData.file_url} target="_blank" rel="noopener noreferrer">Voir le document</a>
              </p>
            )}
          </section>

          {isAdmin && (
            <section className="form-section">
              <h3>Visibilité</h3>
              <p>Qui peut voir ces infos ?</p>
              <div className="checkbox-group">
                {entreprises.map(v => (
                  <label key={v}>
                    <input 
                      type="checkbox" 
                      checked={Array.isArray(formData.visibilite) && formData.visibilite.includes(v)}
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
