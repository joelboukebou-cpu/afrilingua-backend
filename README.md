# AfriLingua — Backend

## Qui détient quoi (à ne jamais mélanger)

| Élément | Où il vit | Secret ? |
|---|---|---|
| Config Firebase client (apiKey, projectId...) | Frontend | Non — public par design |
| Compte de service Firebase Admin (JSON) | Serveur, `config/firebase-service-account.json`, via `.env` | **Oui** |
| Agora App ID | Frontend ET serveur | Non |
| Agora App Certificate | Serveur uniquement, `.env` | **Oui** |
| Flutterwave clé publique | Frontend | Non |
| Flutterwave clé secrète | Serveur uniquement, `.env` | **Oui** |
| Flutterwave hash webhook | Serveur uniquement, `.env` | **Oui** |

## Installation

```bash
cd afrilingua-backend
npm install
cp .env.example .env
# Remplis .env avec tes vraies clés
# Place ton fichier de compte de service Firebase dans config/firebase-service-account.json
npm start
```

## Ce que fait chaque route

- `POST /api/paiement/initier-recharge` — le frontend appelle ça avant d'ouvrir Flutterwave pour une recharge de pièces. Le prix et la quantité de pièces viennent du serveur, jamais du client.
- `POST /api/paiement/initier-reservation-tuteur` — pareil pour une réservation de cours.
- `POST /api/paiement/webhook` — Flutterwave appelle cette URL après un paiement. **C'est la seule route qui crédite réellement des pièces ou confirme une réservation.** À configurer dans Dashboard Flutterwave > Paramètres > Webhooks avec l'URL publique de ton serveur (ex. `https://ton-serveur.com/api/paiement/webhook`).
- `POST /api/agora/token` — génère un token temporaire pour rejoindre un live ou un salon vocal.
- `GET /api/live/catalogue-cadeaux` / `POST /api/live/envoyer-cadeau` — système de cadeaux en live, payés en pièces déjà achetées, avec 30% de commission plateforme.

## Prochaines étapes

1. Créer ton compte Agora, récupérer l'App ID (à me donner) et l'App Certificate (à mettre toi-même dans `.env`).
2. Déployer ce serveur sur ton hébergement.
3. Configurer l'URL du webhook dans le dashboard Flutterwave.
4. Tester en mode "test" Flutterwave avant de basculer en clés live.
5. Remplacer les comptes fictifs du frontend par Firebase Auth + Firestore (profils réels avec photo, bio, niveau, passions, abonnés).
