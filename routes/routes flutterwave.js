const express = require("express");
const axios = require("axios");
const router = express.Router();
const { db, admin } = require("../utils/firebaseAdmin");

const COMMISSION_TUTEURS = Number(process.env.COMMISSION_TUTEURS_POURCENT || 20) / 100;
const COMMISSION_PIECES = Number(process.env.COMMISSION_PIECES_ET_CADEAUX_POURCENT || 30) / 100;

const PACKS_PIECES = {
  pack_50: { pieces: 50, prixFcfa: 500 },
  pack_120: { pieces: 120, prixFcfa: 1000 },
  pack_300: { pieces: 300, prixFcfa: 2000 },
};

function genererTxRef(prefixe, uid) {
  return prefixe + "_" + uid + "_" + Date.now();
}

router.post("/initier-recharge", async (req, res) => {
  const { uid, packId } = req.body;
  const pack = PACKS_PIECES[packId];
  if (!uid || !pack) {
    return res.status(400).json({ erreur: "Utilisateur ou pack de pieces invalide." });
  }
  const txRef = genererTxRef("recharge", uid);
  await db.collection("transactionsEnAttente").doc(txRef).set({
    type: "recharge_pieces",
    uid,
    pieces: pack.pieces,
    montantFcfa: pack.prixFcfa,
    statut: "en_attente",
    creeLe: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ txRef, montantFcfa: pack.prixFcfa, pieces: pack.pieces });
});

router.post("/initier-reservation-tuteur", async (req, res) => {
  const { uid, tuteurId, prixFcfa } = req.body;
  if (!uid || !tuteurId || !prixFcfa) {
    return res.status(400).json({ erreur: "Champs manquants pour la reservation." });
  }
  const txRef = genererTxRef("cours", uid);
  const commission = Math.round(prixFcfa * COMMISSION_TUTEURS);
  await db.collection("transactionsEnAttente").doc(txRef).set({
    type: "reservation_tuteur",
    uid,
    tuteurId,
    montantFcfa: prixFcfa,
    commissionPlateforme: commission,
    montantTuteur: prixFcfa - commission,
    statut: "en_attente",
    creeLe: admin.firestore.FieldValue.serverTimestamp(),
  });
  res.json({ txRef, montantFcfa: prixFcfa });
});

router.post("/webhook", express.json(), async (req, res) => {
  const hashRecu = req.headers["verif-hash"];
  if (!hashRecu || hashRecu !== process.env.FLUTTERWAVE_WEBHOOK_HASH) {
    return res.status(401).json({ erreur: "Signature webhook invalide." });
  }

  const evenement = req.body;
  const idTransactionFlutterwave = evenement && evenement.data && evenement.data.id;
  const txRef = evenement && evenement.data && evenement.data.tx_ref;
  if (!idTransactionFlutterwave || !txRef) {
    return res.status(400).json({ erreur: "Payload webhook incomplet." });
  }

  try {
    const verification = await axios.get(
      "https://api.flutterwave.com/v3/transactions/" + idTransactionFlutterwave + "/verify",
      { headers: { Authorization: "Bearer " + process.env.FLUTTERWAVE_SECRET_KEY } }
    );

    const donnees = verification.data.data;
    if (donnees.status !== "successful") {
      return res.status(200).json({ statut: "ignore", raison: "paiement non reussi" });
    }

    const refDocAttente = db.collection("transactionsEnAttente").doc(txRef);
    const docAttente = await refDocAttente.get();
    if (!docAttente.exists) {
      return res.status(404).json({ erreur: "Transaction en attente introuvable." });
    }
    const infosAttente = docAttente.data();

    if (infosAttente.statut === "complete") {
      return res.status(200).json({ statut: "deja_traite" });
    }
    if (Number(donnees.amount) < Number(infosAttente.montantFcfa)) {
      return res.status(400).json({ erreur: "Montant paye inferieur au montant attendu." });
    }

    if (infosAttente.type === "recharge_pieces") {
      const commission = Math.round(infosAttente.montantFcfa * COMMISSION_PIECES);
      await db.runTransaction(async (t) => {
        const refUtilisateur = db.collection("utilisateurs").doc(infosAttente.uid);
        t.update(refUtilisateur, {
          pieces: admin.firestore.FieldValue.increment(infosAttente.pieces),
        });
        t.update(refDocAttente, {
          statut: "complete",
          commissionPlateforme: commission,
          idTransactionFlutterwave,
          completeLe: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    } else if (infosAttente.type === "reservation_tuteur") {
      await db.runTransaction(async (t) => {
        const refTuteur = db.collection("utilisateurs").doc(infosAttente.tuteurId);
        t.update(refTuteur, {
          soldeFcfa: admin.firestore.FieldValue.increment(infosAttente.montantTuteur),
        });
        t.update(refDocAttente, {
          statut: "complete",
          idTransactionFlutterwave,
          completeLe: admin.firestore.FieldValue.serverTimestamp(),
        });
        t.set(db.collection("reservationsCours").doc(txRef), {
          eleveId: infosAttente.uid,
          tuteurId: infosAttente.tuteurId,
          montantFcfa: infosAttente.montantFcfa,
          commissionPlateforme: infosAttente.commissionPlateforme,
          statut: "confirmee",
          creeLe: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    res.status(200).json({ statut: "ok" });
  } catch (e) {
    console.error("Erreur webhook Flutterwave :", e.message);
    res.status(500).json({ erreur: "Erreur serveur lors du traitement du webhook." });
  }
});

module.exports = router;
