# ITSM Platform — Module A : Authentification & Gestion des utilisateurs

## Arborescence

```
src/
├── app.js                        ← Point d'entrée Express
├── db.js                         ← Connexion PostgreSQL (existante)
├── controllers/
│   ├── authController.js         ← Logique login/register/me/logout
│   └── userController.js         ← CRUD utilisateurs
├── routes/
│   ├── authRoutes.js             ← /api/auth/*
│   └── userRoutes.js             ← /api/users/*
├── middlewares/
│   ├── authMiddleware.js         ← Vérification JWT
│   └── roleMiddleware.js         ← RBAC (authorize)
└── services/
    └── authService.js            ← JWT, bcrypt, requêtes DB communes
```

---

## Installation

```bash
# 1. Copier les variables d'environnement
cp .env.example .env
# Renseigner DB_PASSWORD et JWT_SECRET dans .env

# 2. Installer les dépendances (déjà fait)
npm install

# 3. Démarrer
npm start           # production
npm run dev         # développement (hot reload)
```

---

## Routes

### Authentification `/api/auth`

| Méthode | Route | Auth requis | Rôle | Description |
|---------|-------|-------------|------|-------------|
| POST | `/login` | Non | - | Connexion (email ou username + password) |
| POST | `/register` | Oui | Admin | Créer un compte utilisateur |
| GET | `/me` | Oui | Tous | Profil du compte connecté |
| POST | `/logout` | Oui | Tous | Déconnexion (stateless) |

### Utilisateurs `/api/users`

| Méthode | Route | Auth requis | Rôle | Description |
|---------|-------|-------------|------|-------------|
| GET | `/` | Oui | Admin, Technicien | Liste tous les utilisateurs |
| GET | `/:id` | Oui | Admin, Technicien | Détail d'un utilisateur |
| POST | `/` | Oui | Admin | Créer un utilisateur |
| PUT | `/:id` | Oui | Admin | Modifier un utilisateur |
| DELETE | `/:id` | Oui | Admin | Supprimer un utilisateur |

---

## Utilisation des middlewares

```js
// Authentification seule
router.get('/route', authenticate, handler)

// Authentification + rôle unique
router.post('/route', authenticate, authorize('Admin'), handler)

// Authentification + rôles multiples
router.get('/route', authenticate, authorize('Admin', 'Technicien'), handler)
```

---

## Format du token JWT

```json
{
  "id": 1,
  "username": "admin",
  "role": "Admin",
  "iat": 1700000000,
  "exp": 1700001800
}
```

Durée de validité : **30 minutes**

---

## Exemples Postman

### 1. Login

```
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "identifier": "admin@ministere.ma",
  "password": "Admin@1234"
}
```

Réponse :
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@ministere.ma",
    "role": "Admin"
  }
}
```

### 2. Register (Admin uniquement)

```
POST http://localhost:3000/api/auth/register
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "technicien1",
  "email": "tech1@ministere.ma",
  "password": "Tech@1234",
  "role_id": 2
}
```

### 3. Me

```
GET http://localhost:3000/api/auth/me
Authorization: Bearer <token>
```

---

## Règles de validation mot de passe

- Minimum 8 caractères
- Au moins 1 majuscule
- Au moins 1 minuscule
- Au moins 1 chiffre
- Au moins 1 caractère spécial (`!@#$%...`)

Exemple valide : `Admin@1234`

---

## Bonnes pratiques de sécurité appliquées

| Mesure | Implémentation |
|--------|----------------|
| Hachage mot de passe | bcrypt, 12 rounds |
| Token JWT signé | HS256, expiration 30 min |
| Headers HTTP sécurisés | helmet |
| CORS configuré | cors (origins contrôlés) |
| Validation des entrées | express-validator |
| Protection SQL Injection | Requêtes paramétrées pg ($1, $2...) |
| Message d'erreur générique | Login : "Identifiants incorrects" (pas de distinction email/mot de passe) |
| Auto-suppression bloquée | Un Admin ne peut pas supprimer son propre compte |
| Limite taille body | 10kb (protection DoS) |

---

## Packages installés

```
express           Framework HTTP
pg                Client PostgreSQL
bcrypt            Hachage des mots de passe
jsonwebtoken      Génération/vérification JWT
helmet            Sécurisation headers HTTP
cors              Gestion CORS
express-validator Validation et sanitisation des inputs
dotenv            Variables d'environnement
```
