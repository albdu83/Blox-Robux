const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch"); // si Node < 18

const app = express();
app.use(cors());
app.use(express.json());

// --- SECRET_KEY TimeWall ---
const SECRET_KEY = process.env.SECRET_KEY || "21b4dc719da5c227745e9d1f23ab1cc0";

// --- Stockage temporaire ---
const users = {};
const transactions = {};

// --- Endpoint Roblox avatar ---
app.get("/timewall", async (req, res) => {
    const { userID, transactionID, currencyAmount, hash, type } = req.query;

    try {
        if (!userID || !transactionID || !currencyAmount || !hash)
            return res.status(400).send("Missing params");

        const computedHash = crypto
            .createHash("sha256")
            .update(userID + currencyAmount + SECRET_KEY)
            .digest("hex");

        if (computedHash !== hash)
            return res.status(400).send("Invalid hash");

        if (transactions[transactionID])
            return res.status(200).send("duplicate");

        const amount = parseInt(currencyAmount, 10);
        if (isNaN(amount))
            return res.status(400).send("Invalid amount");

        transactions[transactionID] = {
            userID,
            amount,
            type,
            date: Date.now()
        };

        if (!users[userID]) users[userID] = { balance: 0 };
        users[userID].balance += amount;

        console.log(`✅ Timewall → User ${userID} +${amount} (${users[userID].balance})`);
        res.status(200).send("OK");

    } catch (err) {
        console.error("Timewall error:", err);
        res.status(500).send("Server error");
    }
});

// --- Endpoint TimeWall ---
app.get("/timewall", async (req, res) => {
    const { userID, transactionID, revenue, currencyAmount, hash, type } = req.query;

    try {
        const computedHash = crypto.createHash("sha256")
            .update(userID + revenue + SECRET_KEY)
            .digest("hex");

        if (computedHash !== hash) return res.status(400).send("Invalid hash");
        if (transactions[transactionID]) return res.status(200).send("duplicate");

        transactions[transactionID] = { userID, revenue, currencyAmount, type, date: Date.now() };
        if (!users[userID]) users[userID] = { balance: 0 };
        users[userID].balance += Number(currencyAmount);

        console.log(`✅ User ${userID} new balance: ${users[userID].balance}`);
        res.status(200).send("OK");

    } catch (err) {
        console.error(err);
        res.status(500).send("Server error");
    }
});

// --- Endpoint Admin ---
const ADMIN_CODE = process.env.ADMIN_CODE || "8SJhLs9SW2ckPfj";

app.post("/checkAdminCode", (req, res) => {
    const { code } = req.body;
    res.json({ valid: code === ADMIN_CODE });
});

app.get("/api/privateservers", async (req, res) => {
  try {
    const serversRes = await fetch("https://games.roblox.com/v1/private-servers/my-private-servers?privateServersTab=0&itemsPerPage=25", {
      headers: { "Cookie": `.ROBLOSECURITY=${process.env.ROBLO_COOKIE}` }
    });
    const data = await serversRes.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Impossible de récupérer les serveurs privés" });
  }
});

app.get("/api/places", async (req, res) => {
    const { targetId  } = req.query;

    try {
        if (!targetId ) {
            return res.status(400).json({ error: "userId manquant" });
        }

        const placesRes = await fetch(
            `https://games.roblox.com/v2/users/${targetId }/games?accessFilter=Public`
        );

        if (!placesRes.ok) {
            return res.status(placesRes.status).json({
                error: "Erreur API Roblox"
            });
        }

        const data = await placesRes.json();

        // On renvoie uniquement ce qui est utile au front
        const formatted = {
            data: data.data.map(game => ({
                name: game.name,
                placeId: game.rootPlace?.id || null
            })).filter(game => game.placeId !== null)
        };

        res.json(formatted);

    } catch (err) {
        console.error("Erreur récupération places :", err);
        res.status(500).json({ error: "Impossible de récupérer les emplacements" });
    }
});

// --- Lancement serveur ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Serveur en ligne sur le port ${PORT}`);
});
