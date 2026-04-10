import os
import firebase_admin
from firebase_admin import credentials, firestore, auth
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from pydantic import BaseModel, EmailStr
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Load backend/.env for local development.
ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(ENV_PATH)

# Initialization
# If running locally, you must set GOOGLE_APPLICATION_CREDENTIALS environment variable
# pointing to your service account JSON file.
# On Cloud Run, it will use the default service account automatically.
if not firebase_admin._apps:
    try:
        firebase_admin.initialize_app()
    except Exception as e:
        print(f"Firebase initialization failed: {e}")
        # For local development with a specific key file (if provided)
        # cred = credentials.Certificate('path/to/serviceAccountKey.json')
        # firebase_admin.initialize_app(cred)

from .models import (
    Demande, DemandeCreate, DemandeUpdate, DemandeBEUpdate, 
    UserInfo, UserRole, UserCreate
)
from .auth import get_current_user, require_role

db = firestore.client()

app = FastAPI(title="Kaliforage Management API")

# testd
allowed_origins_raw = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in allowed_origins_raw.split(",") if origin.strip()]

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Kaliforage API is running"}

# --- AUTH ROUTES ---

@app.get("/api/auth/me", response_model=UserInfo)
async def get_me(current_user: UserInfo = Depends(get_current_user)):
    return current_user

# --- DEMANDES ROUTES ---

@app.get("/api/demandes", response_model=List[Demande])
async def list_demandes(current_user: UserInfo = Depends(get_current_user)):
    demandes_ref = db.collection("demandes")
    
    if current_user.role == UserRole.ADMIN:
        docs = demandes_ref.stream()
    else:
        # Filter by visibility for BE users
        # BE FONDASOLUTION sees requests where "visibilite" contains "FONDASOLUTION"
        # BE KALIFORAGE INGENIERIE sees requests where "visibilite" contains "KALIFORAGE INGENIERIE"
        docs = demandes_ref.where("visibilite", "array_contains", current_user.role.value).stream()
    
    results = []
    for doc in docs:
        data = doc.to_dict()
        # Firestore returns datetime objects, which Pydantic handles
        results.append(Demande(id=doc.id, **data))
    
    return results

@app.post("/api/demandes", response_model=Demande)
async def create_demande(
    demande: DemandeCreate, 
    current_user: UserInfo = Depends(require_role([UserRole.ADMIN]))
):
    demande_data = demande.dict()
    # Add auto-increment ID logic if needed, otherwise use Firestore's ID
    # For now, we use Firestore auto ID
    update_time, doc_ref = db.collection("demandes").add(demande_data)
    return Demande(id=doc_ref.id, **demande_data)

@app.put("/api/demandes/{demande_id}", response_model=Demande)
async def update_demande(
    demande_id: str,
    demande_update: dict, # Using dict to handle partial updates flexibly
    current_user: UserInfo = Depends(get_current_user)
):
    doc_ref = db.collection("demandes").document(demande_id)
    doc = doc_ref.get()
    
    if not doc.exists:
        raise HTTPException(status_code=404, detail="Demande not found")
    
    demande_data = doc.to_dict()
    
    if current_user.role == UserRole.ADMIN:
        # Full update allowed
        # Validate with DemandeUpdate model
        try:
            update_obj = DemandeUpdate(**demande_update)
            update_data = {k: v for k, v in update_obj.dict().items() if v is not None}
            doc_ref.update(update_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
    else:
        # BE User: check if they have visibility
        if current_user.role.value not in demande_data.get("visibilite", []):
            raise HTTPException(status_code=403, detail="Not authorized to edit this demande")
        
        # Restricted update
        try:
            update_obj = DemandeBEUpdate(**demande_update)
            update_data = {k: v for k, v in update_obj.dict().items() if v is not None}
            doc_ref.update(update_data)
        except Exception as e:
            raise HTTPException(status_code=400, detail=str(e))
            
    updated_doc = doc_ref.get().to_dict()
    return Demande(id=demande_id, **updated_doc)

@app.delete("/api/demandes/{demande_id}")
async def delete_demande(
    demande_id: str,
    current_user: UserInfo = Depends(require_role([UserRole.ADMIN]))
):
    db.collection("demandes").document(demande_id).delete()
    return {"message": "Deleted successfully"}

# --- USER MANAGEMENT ROUTES ---

@app.get("/api/users", response_model=List[UserInfo])
async def list_users(current_user: UserInfo = Depends(require_role([UserRole.ADMIN]))):
    docs = db.collection("users").stream()
    return [UserInfo(email=doc.id, role=doc.to_dict()["role"]) for doc in docs]

@app.post("/api/users", response_model=UserInfo)
async def create_user(
    user: UserCreate,
    current_user: UserInfo = Depends(require_role([UserRole.ADMIN]))
):
    db.collection("users").document(user.email).set({"role": user.role.value})
    return user

@app.delete("/api/users/{email}")
async def delete_user(
    email: str,
    current_user: UserInfo = Depends(require_role([UserRole.ADMIN]))
):
    db.collection("users").document(email).delete()
    return {"message": "User deleted"}

# --- INITIALIZATION ROUTE (DEBUG/FIRST RUN) ---

@app.post("/api/init-admin")
async def init_admin(res: HTTPAuthorizationCredentials = Depends(HTTPBearer())):
    # Verify token
    try:
        decoded_token = auth.verify_id_token(res.credentials)
        email = decoded_token.get("email")
        
        # Check if users collection is empty
        users_ref = db.collection("users")
        if len(list(users_ref.limit(1).stream())) == 0:
            users_ref.document(email).set({"role": UserRole.ADMIN.value})
            return {"message": f"User {email} promoted to first ADMIN"}
        else:
            raise HTTPException(status_code=403, detail="System already initialized")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
