from pydantic import BaseModel, EmailStr, Field
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

class TypeIntervention(str, Enum):
    G1_PGC = "🟡 G1 PGC"
    G2_AVP = "🔵 G2 AVP"
    G2_PRO = "🟠 G2 PRO"
    G5 = "🟣 G5"
    G0 = "🟢 G0"
    ASSAINISSEMENT = "🔴 Etude d’assainissement"
    AUTRE = "⚫ Autre.."

class Visibilite(str, Enum):
    FONDASOLUTION = "FONDASOLUTION"
    KALIFORAGE_INGENIERIE = "KALIFORAGE INGENIERIE"

class DemandeBase(BaseModel):
    date_demande: Optional[datetime] = None
    adresse_chantier: str
    nom_client: str
    telephone: str
    email: str
    adresse_facturation: str
    type_intervention: List[str]
    description: Optional[str] = None
    etat: EtatDemande = EtatDemande.EN_ATTENTE
    date_sondage_prevue: Optional[datetime] = None
    date_remise_rapport_prevue: Optional[datetime] = None
    montant_chantier: float = 0.0
    type_revenu: Optional[TypeRevenu] = None
    revenu: float = 0.0
    commentaire: Optional[str] = None
    visibilite: List[Visibilite] = []

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
    type_revenu: Optional[TypeRevenu] = None
    revenu: Optional[float] = None
    commentaire: Optional[str] = None
    visibilite: Optional[List[Visibilite]] = None

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
    type_revenu: Optional[TypeRevenu] = None
    revenu: Optional[float] = None
    commentaire: Optional[str] = None

class Demande(DemandeBase):
    id: str

class UserRole(str, Enum):
    ADMIN = "ADMIN"
    FONDASOLUTION = "FONDASOLUTION"
    KALIFORAGE_INGENIERIE = "KALIFORAGE INGENIERIE"

class UserInfo(BaseModel):
    email: EmailStr
    role: UserRole

class UserCreate(UserInfo):
    pass
