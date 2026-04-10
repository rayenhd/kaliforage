# Kaliforage Management System

Application de gestion des demandes avec backend FastAPI et frontend React.

## Configuration Firebase

1.  Créez un projet sur la console Firebase.
2.  Activez **Authentication** avec le fournisseur **Google**.
3.  Activez **Firestore Database**.
4.  Générez une clé de service (Service Account JSON) dans les paramètres du projet Google Cloud.
5.  Récupérez les clés de configuration Web pour le frontend.

## Installation & Lancement

### Backend (FastAPI)

1.  Allez dans le dossier `backend`.
2.  Installez les dépendances : `pip install -r requirements.txt`.
3.  Créez un fichier `.env` à partir de `.env.example` et renseignez les variables.
4.  Lancez le serveur : `uvicorn app.main:app --reload`.

### Frontend (React)

1.  Allez dans le dossier `frontend`.
2.  Créez un fichier `.env` basé sur le template fourni et remplissez vos clés Firebase.
3.  Installez les dépendances : `npm install`.
4.  Lancez l'application : `npm start`.

## Rôles

*   **ADMIN** : Accès total, peut créer des demandes, gérer les utilisateurs.
*   **FONDASOLUTION** : Accès restreint aux demandes marquées pour cette entité.
*   **KALIFORAGE INGENIERIE** : Accès restreint aux demandes marquées pour cette entité.

*Note: Le premier utilisateur à se connecter via Google deviendra automatiquement ADMIN si la base de données est vide.*
