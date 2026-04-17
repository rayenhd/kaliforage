from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from firebase_admin import auth, firestore
from .models import UserInfo
import logging

security = HTTPBearer()
db = firestore.client()

async def get_current_user(res: HTTPAuthorizationCredentials = Depends(security)) -> UserInfo:
    token = res.credentials
    try:
        decoded_token = auth.verify_id_token(token)
        email = decoded_token.get("email")
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token does not contain email",
            )
        
        # Check user role in Firestore
        user_doc = db.collection("users").document(email).get()
        if not user_doc.exists:
            # For the first run or if not found, we might want to handle it.
            # Maybe the first user is an admin by default if we want? 
            # Or just deny access.
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User not registered in the system",
            )
        
        user_data = user_doc.to_dict()
        role = user_data.get("role")
        
        return UserInfo(email=email, role=role)
        
    except Exception as e:
        logging.error(f"Auth error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

def require_role(allowed_roles: list[str]):
    async def role_checker(current_user: UserInfo = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )
        return current_user
    return role_checker
