/* ============================================================
   AfriLingua — Serveur backend
   ------------------------------------------------------------
   Rôle : tout ce qui touche à un secret (clés Flutterwave/Agora,
   compte de service Firebase) ou à de l'argent réel passe par
   ici. Le frontend ne détient jamais rien de sensible.
   ============================================================ */
require("dotenv").config();
const express = require("express");
const cors = require("cors");

const routesFlutterwave = require("./routes/flutterwave");
const routesAgora = require("./routes/agora");
const routesLive = require("./routes/live");

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL || "*" }));
app.use(express.json());

app.get("/", (req, res) => res.send("Serveur AfriLingua actif."));

app.use("/api/paiement", routesFlutterwave);
app.use("/api/agora", routesAgora);
app.use("/api/live", routesLive);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Serveur AfriLingua démarré sur le port ${PORT}`);
});
