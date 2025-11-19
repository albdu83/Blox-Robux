const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch"); // si Node < 18

const app = express();
app.use(cors());
app.use(express.json());

// --- SECRET_KEY TimeWall ---
const SECRET_KEY = "21b4dc719da5c227745e9d1f23ab1cc0";

// --- Stockage temporaire (à remplacer par Firebase ou DB réelle) ---
const users = {}; // { userID: { balance: 0 } }
const transactions = {}; // { transactionID: true }

// --- Endpoint Roblox avatar ---
app.get("/api/avatar/:username", async (req, res) => {
    const username = req.params.username;

    try {
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
        });

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }

        const userId = data.data[0].id;

        const avatarRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );

        const avatarData = await avatarRes.json();

        if (!avatarData.data || avatarData.data.length === 0) {
            return res.status(500).json({ error: "Erreur avatar Roblox" });
        }

        const avatarUrl = avatarData.data[0].imageUrl;
        res.json({ avatarUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

// --- Endpoint TimeWall ---
app.get("/timewall", async (req, res) => {
  const { userID, transactionID, revenue, currencyAmount, hash, type } = req.query;

  try {
    // Vérification hash
    const computedHash = crypto.createHash("sha256")
      .update(userID + revenue + SECRET_KEY)
      .digest("hex");

    if (computedHash !== hash) {
      console.log("❌ HASH INVALID");
      return res.status(400).send("Invalid hash");
    }

    // Vérifier transaction unique
    if (transactions[transactionID]) return res.status(200).send("duplicate");

    // Enregistrer transaction
    transactions[transactionID] = { userID, revenue, currencyAmount, type, date: Date.now() };

    // Crédits/débits
    if (!users[userID]) users[userID] = { balance: 0 };
    users[userID].balance += Number(currencyAmount);

    console.log(`✅ User ${userID} new balance: ${users[userID].balance}`);

    // Retourner OK à TimeWall
    res.status(200).send("OK");

  } catch (err) {
    console.error(err);
    res.status(500).send("Server error");
  }
});

// --- Lancement serveur ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Serveur en ligne sur port ${PORT}`));
