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

app.get("/api/avatar/:username", async (req, res) => {
    const username = req.params.username;

    try {
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
        });

        const data = await response.json();
        if (!data.data || data.data.length === 0) return res.status(404).json({ error: "Utilisateur introuvable" });

        const userId = data.data[0].id;

        const avatarRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );

        const avatarData = await avatarRes.json();
        if (!avatarData.data || avatarData.data.length === 0) return res.status(500).json({ error: "Erreur avatar Roblox" });

        res.json({
            avatarUrl: avatarData.data[0].imageUrl,
            targetId: userId
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

const admin = require("firebase-admin");


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: "https://bloxrobux-e9244-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

const db = admin.database();

app.get("/timewall", async (req, res) => {
  const { userID, transactionID, currencyAmount, revenue, hash, type } = req.query;
  console.log("🔥 /timewall HIT", req.query);

  try {
    if (!userID || !transactionID || !revenue || !hash) {
      console.log("❌ Paramètres manquants");
      return res.status(200).send("OK");
    }

    // ✅ HASH = revenue (PAS currencyAmount)
    const computedHash = crypto
      .createHash("sha256")
      .update(userID + revenue + SECRET_KEY)
      .digest("hex");

    if (computedHash !== hash) {
      console.log("❌ Hash invalide", {
        userID,
        revenue,
        received: hash,
        expected: computedHash
      });
      return res.status(200).send("OK");
    }

    // ✅ Solde = currencyAmount
    const amount = Math.round(Number(currencyAmount));
    if (amount <= 0) {
      console.log("❌ Amount invalide :", currencyAmount);
      return res.status(200).send("OK");
    }

    // 🔎 Récupération UID Firebase via RobloxName
    const snap = await db.ref("users")
      .orderByChild("RobloxName")
      .equalTo(userID)
      .get();

    if (!snap.exists()) {
      console.log("❌ Utilisateur Firebase introuvable");
      return res.status(200).send("OK");
    }

    const uid = Object.keys(snap.val())[0];

    // 🔒 Anti-doublon
    const txRef = db.ref("transactions/" + transactionID);
    if ((await txRef.get()).exists()) {
      console.log("⚠️ Transaction déjà traitée");
      return res.status(200).send("OK");
    }

    await txRef.set({ uid, amount, type, date: Date.now() });

    await db.ref(`users/${uid}/balance`)
      .transaction(v => (v || 0) + amount);

    console.log(`✅ Crédité ${userID} (${uid}) +${amount}`);
    return res.status(200).send("OK");

  } catch (err) {
    console.error("🔥 TimeWall error:", err);
    return res.status(200).send("OK");
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
