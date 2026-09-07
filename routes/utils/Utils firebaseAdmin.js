const admin = require("firebase-admin");
const path = require("path");
require("dotenv").config();

const cheminCompteService = path.resolve(
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "./config/firebase-service-account.json"
);

let serviceAccount;
try {
  serviceAccount = require(cheminCompteService);
} catch (e) {
  console.error(
    "Impossible de charger le compte de service Firebase. " +
    "Telecharge-le depuis Firebase Console > Parametres du projet > Comptes de service, " +
    "place-le a l'emplacement defini par FIREBASE_SERVICE_ACCOUNT_PATH dans les variables d'environnement, " +
    "puis relance le serveur."
  );
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
