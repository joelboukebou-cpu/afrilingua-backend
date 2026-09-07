const express = require("express");
const router = express.Router();
const { db, admin } = require("../utils/firebaseAdmin");

const COMMISSION_PIECES = Number(process.env.COMMISSION_PIECES_ET_CADEAUX_POURCENT || 30) / 100;

const CATALOGUE_CADEAUX = {
  cadeau_coeur: { nom: "Coeur", emoji: "❤️", coutPieces: 5 },
  cadeau_tambour: { nom: "Tambour", emoji: "🥁", coutPieces: 20 },
  cadeau_couronne: { nom: "Couronne", emoji: "👑", coutPieces: 100 },
  cadeau_etoile: { nom: "Etoile filante", emoji: "🌠", coutPieces: 50 },
};

router.get("/catalogue-cadeaux", (req, res) => {
  res.json(CATALOGUE_CADEAUX);
});

router.post("/envoyer-cadeau", async (req, res) => {
  const { expediteurUid, hoteUid, cadeauId, canalLiveId } = req.body;
  const cadeau = CATALOGUE_CADEAUX[cadeauId];
  if (!expediteurUid || !hoteUid || !cadeau) {
    return res.status(400).json({ erreur: "Requete de cadeau invalide." });
  }
  if (expediteurUid === hoteUid) {
    return res.status(400).json({ erreur: "Impossible de s'envoyer un cadeau a soi-meme." });
  }

  const partPlateforme = Math.ceil(cadeau.coutPieces * COMMISSION_PIECES);
  const partHote = cadeau.coutPieces - partPlateforme;

  try {
    await db.runTransaction(async (t) => {
      const refExpediteur = db.collection("utilisateurs").doc(expediteurUid);
      const docExpediteur = await t.get(refExpediteur);
      const donneesExp = docExpediteur.data();
      const soldeActuel = (donneesExp && donneesExp.pieces) || 0;

      if (soldeActuel < cadeau.coutPieces) {
        throw new Error("SOLDE_INSUFFISANT");
      }

      const refHote = db.collection("utilisateurs").doc(hoteUid);
      t.update(refExpediteur, { pieces: admin.firestore.FieldValue.increment(-cadeau.coutPieces) });
      t.update(refHote, { pieces: admin.firestore.FieldValue.increment(partHote) });

      t.set(db.collection("cadeauxEnvoyes").doc(), {
        expediteurUid,
        hoteUid,
        canalLiveId: canalLiveId || null,
        cadeauId,
        coutPieces: cadeau.coutPieces,
        partPlateforme,
        partHote,
        envoyeLe: admin.firestore.FieldValue.serverTimestamp(),
      });
    });

    res.json({ statut: "ok", cadeau, partHote, partPlateforme });
  } catch (e) {
    if (e.message === "SOLDE_INSUFFISANT") {
      return res.status(402).json({ erreur: "Solde de pieces insuffisant." });
    }
    console.error("Erreur envoi cadeau :", e.message);
    res.status(500).json({ erreur: "Erreur serveur lors de l'envoi du cadeau." });
  }
});

module.exports = router;
