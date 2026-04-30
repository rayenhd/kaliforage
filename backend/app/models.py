from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import List, Optional
from datetime import datetime
from enum import Enum

class EtatDemande(str, Enum):
    EN_ATTENTE = "🟡 En attente"
    DEVIS_ENVOYE = "🔵 Devis envoyé"
    DEVIS_ACCEPTE = "🟠 Devis Accepté"
    PLANIFIE = "🟣 Planifié"
    REALISE = "🟢 Réalisé"
    REFUSE = "🔴 Refusé / abandonné"

class TypeRevenu(str, Enum):
    APPORT_AFFAIRES = "🟡 Apport d’affaires"
    LOCATION_MACHINE = "🔵 Location Machine"
    SONDAGE = "🟣 Sondage"

class TypeIntervention(str, Enum):
    G1_PGC = "🟡 G1 PGC"
    G2_AVP = "🔵 G2 AVP"
    G2_PRO = "🟠 G2 PRO"
    G5 = "🟣 G5"
    G0 = "🟢 G0"
    ASSAINISSEMENT = "🔴 Etude d’assainissement"
    AUTRE = "⚫ Autre.."

class DemandeBase(BaseModel):
    date_demande: Optional[datetime] = None
    adresse_chantier: Optional[str] = None
    nom_client: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse_facturation: Optional[str] = None
    type_intervention: List[str] = Field(default_factory=list)
    description: Optional[str] = None
    etat: EtatDemande = EtatDemande.EN_ATTENTE
    date_sondage_prevue: Optional[datetime] = None
    date_remise_rapport_prevue: Optional[datetime] = None
    montant_chantier: float = 0.0
    type_revenu: List[TypeRevenu] = Field(default_factory=list)
    revenu: Optional[str] = None
    commentaire: Optional[str] = None
    visibilite: List[str] = Field(default_factory=list)
    file_url: Optional[str] = None

    @field_validator("type_revenu", mode="before")
    @classmethod
    def normalize_type_revenu(cls, value):
        if value is None:
            return []
        return value if isinstance(value, list) else [value]

class DemandeCreate(DemandeBase):
    pass

class DemandeUpdate(BaseModel):
    # Admin can update everything, but we make fields optional for partial updates
    date_demande: Optional[datetime] = None
    adresse_chantier: Optional[str] = None
    nom_client: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse_facturation: Optional[str] = None
    type_intervention: Optional[List[str]] = None
    description: Optional[str] = None
    etat: Optional[EtatDemande] = None
    date_sondage_prevue: Optional[datetime] = None
    date_remise_rapport_prevue: Optional[datetime] = None
    montant_chantier: Optional[float] = None
    type_revenu: Optional[List[TypeRevenu]] = None
    revenu: Optional[str] = None
    commentaire: Optional[str] = None
    visibilite: Optional[List[str]] = None
    file_url: Optional[str] = None

    @field_validator("type_revenu", mode="before")
    @classmethod
    def normalize_type_revenu(cls, value):
        if value is None:
            return None
        return value if isinstance(value, list) else [value]

class DemandeBEUpdate(BaseModel):
    # Restricted update for BE users
    etat: Optional[EtatDemande] = None
    date_sondage_prevue: Optional[datetime] = None
    date_remise_rapport_prevue: Optional[datetime] = None
    montant_chantier: Optional[float] = None
    commentaire: Optional[str] = None


class DemandeEntrepriseUpdate(BaseModel):
    # Company users can update all request fields except visibility.
    date_demande: Optional[datetime] = None
    adresse_chantier: Optional[str] = None
    nom_client: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None
    adresse_facturation: Optional[str] = None
    type_intervention: Optional[List[str]] = None
    description: Optional[str] = None
    etat: Optional[EtatDemande] = None
    date_sondage_prevue: Optional[datetime] = None
    date_remise_rapport_prevue: Optional[datetime] = None
    montant_chantier: Optional[float] = None
    type_revenu: Optional[List[TypeRevenu]] = None
    revenu: Optional[str] = None
    commentaire: Optional[str] = None
    file_url: Optional[str] = None

    @field_validator("type_revenu", mode="before")
    @classmethod
    def normalize_type_revenu(cls, value):
        if value is None:
            return None
        return value if isinstance(value, list) else [value]

class Demande(DemandeBase):
    id: str

class UserRole(str, Enum):
    ADMIN = "ADMIN"

class UserInfo(BaseModel):
    email: EmailStr
    role: str

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("role must not be empty")
        return cleaned

class Entreprise(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        cleaned = value.strip()
        if not cleaned:
            raise ValueError("name must not be empty")
        if cleaned.upper() == "ADMIN":
            raise ValueError("ADMIN is reserved")
        return cleaned

class UserCreate(UserInfo):
    pass
