const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch"); // si Node < 18

const app = express();
app.use(cors());
app.use(express.json());

// --- SECRET_KEY TimeWall ---
const SECRET_KEY = process.env.SECRET_KEY || "21b4dc719da5c227745e9d1f23ab1cc0";
const THEOREM_SECRET = process.env.THEOREM_SECRET || "6e5a9ccc2f7788d13bfce09e4c832c41ef6a97b3";

function verifyTheoremReachHash(originalUrl, secret) {
  const urlPart = originalUrl.split("/reach?")[1];
  const [queryString, receivedHash] = urlPart.split("&hash=");

  const computedHash = crypto
    .createHmac("sha1", secret)
    .update(queryString, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {
    valid: computedHash === receivedHash,
    queryString,
    computedHash,
    receivedHash
  };
}

// --- Stockage temporaire ---
const users = {};
const transactions = {};

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

// --- Endpoint TimeWall ---
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
    const amount = Math.ceil(Number(currencyAmount));
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

app.get("/reach", (req, res) => {
  console.log("🔥 /reach HIT", req.originalUrl);

  const { reward, user_id, tx_id, hash, reversal } = req.query;

  if (!reward || !user_id || !tx_id || !hash) {
    return res.status(200).send("OK");
  }

  if (reversal === "true") {
    return res.status(200).send("OK");
  }

  const result = verifyTheoremReachHash(
    req.originalUrl,
    THEOREM_SECRET
  );

  console.log("RAW QUERY :", result.queryString);
  console.log("HASH CALCULÉ :", result.computedHash);
  console.log("HASH REÇU    :", result.receivedHash);

  if (!result.valid) {
    console.log("❌ HASH INVALIDE");
    return res.status(200).send("OK");
  }

  console.log("✅ HASH VALIDE");
  return res.status(200).send("OK");
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

app.post("/api/join-server", async (req, res) => {
  try {
    const { placeId } = req.body;
    if (!placeId) return res.status(400).json({ error: "placeId manquante" });

    // 1️⃣ Récupérer les détails de la place pour obtenir l'universeId
    const detailsRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${placeId}`);
    if (!detailsRes.ok) throw new Error(`Erreur récupération place: ${detailsRes.status}`);
    const detailsData = await detailsRes.json();

    if (!detailsData?.data || detailsData.data.length === 0) {
      return res.status(404).json({ error: "Place introuvable" });
    }

    const universeId = detailsData.data[0].universeId;
    if (!universeId) return res.status(500).json({ error: "Impossible de récupérer l'universeId" });

    // 2️⃣ Créer ou rejoindre un VIP server
    const csrfRes = await fetch(`https://games.roblox.com/v1/games/${universeId}/vip-servers`, {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${process.env.ROBLO_COOKIE}`
      }
    });

    const csrfToken = csrfRes.headers.get("x-csrf-token");
    if (!csrfToken) return res.status(500).json({ error: "Impossible de récupérer le token CSRF" });

    const joinRes = await fetch(`https://games.roblox.com/v1/games/${universeId}/vip-servers`, {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${process.env.ROBLO_COOKIE}`,
        "X-CSRF-TOKEN": csrfToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: "Serveur VIP",
        maxPlayers: 10
      })
    });

    const joinData = await joinRes.json();

    if (!joinRes.ok) {
      return res.status(joinRes.status).json({ error: joinData });
    }

    res.json(joinData);

  } catch (err) {
    console.error("Erreur /join-server:", err);
    res.status(500).json({ error: "Impossible de rejoindre/créer le serveur privé" });
  }
});

app.get("/api/places", async (req, res) => {
    const { targetId  } = req.query;

    try {
        if (!targetId ) {
            return res.status(400).json({ error: "userId manquant" });
        }

        const placesRes = await fetch(
            `https://games.roblox.com/v2/users/${targetId}/games?accessFilter=Public`
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
                ID: game.id || null
            })).filter(game => game.ID !== null)
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
