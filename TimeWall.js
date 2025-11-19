const express = require("express");
const crypto = require("crypto");
const admin = require("firebase-admin");
const cors = require("cors");

const app = express();
const SECRET_KEY = "5521b8cc6800e3a187e4ea9db4d9cc38";
const WHITELIST_IPS = ["51.81.120.73", "142.111.248.18"];

admin.initializeApp({
  credential: admin.credential.cert("./serviceAccountKey.json"),
  databaseURL: "https://blox-robux.onrender.com"
});

app.use(cors());

app.get("/timewall", async (req, res) => {
  const { userID, transactionID, revenue, currencyAmount, hash, type } = req.query;

  // Vérification IP
  const rawIp = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
  const ip = rawIp.replace("::ffff:", "");

  if (!WHITELIST_IPS.includes(ip)) return res.status(403).send("Invalid IP");

  // Vérification Hash
  const expectedHash = crypto.createHash("sha256")
    .update(userID + revenue + SECRET_KEY)
    .digest("hex");

  if (expectedHash !== hash) return res.status(403).send("Invalid Hash");

  // Vérification doublon
  const txRef = admin.database().ref("transactions/" + transactionID);
  const txSnap = await txRef.once("value");
  if (txSnap.exists()) return res.status(200).send("Duplicate transaction");

  // Mise à jour du solde
  const userRef = admin.database().ref("users/" + userID + "/balance");
  await userRef.transaction(current => (current || 0) + Number(currencyAmount));

  // Enregistrer la transaction
  await txRef.set({
    userID,
    currencyAmount,
    revenue,
    type,
    date: Date.now()
  });

  console.log(`Transaction ${transactionID}: ${currencyAmount} crédité à ${userID}`);
  res.status(200).send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur TimeWall en ligne sur port ${PORT}`));
