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
                ID: game.id || null,
                RootID: game.rootPlace?.id || null
            })).filter(game => game.RootID !== null).filter(game => game.ID !== null)
        };

        res.json(formatted);

    } catch (err) {
        console.error("Erreur récupération places :", err);
        res.status(500).json({ error: "Impossible de récupérer les emplacements" });
    }
});

const ROBLO_COOKIE = process.env.ROBLO_COOKIE;

// --- Vérifier la balance ---
async function getUserBalance(RobloxName) {
  const snap = await db.ref("users").orderByChild("RobloxName").equalTo(RobloxName).get();
  if (!snap.exists()) return null;
  const uid = Object.keys(snap.val())[0];
  return { uid, balance: snap.val()[uid].balance || 0 };
}

// --- Déduire la balance et créer transaction ---
async function deductBalance(uid, amount, gameId) {
  await db.ref(`users/${uid}/balance`).transaction(current => (current || 0) - amount);
  const txRef = db.ref("transactions").push();
  await txRef.set({ uid, gameId, amount, date: Date.now() });
}

app.post("/api/payServer", async (req, res) => {
  const { name, gameId, amount } = req.body;
  if (!name || !gameId || !amount) 
    return res.status(400).json({ error: "Paramètres manquants" });

  try {
    // 1️⃣ Vérifier solde
    const user = await getUserBalance(name);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });
    if (user.balance < amount) 
      return res.status(400).json({ error: `Solde insuffisant (${user.balance} R$)` });

    // 2️⃣ Récupérer universeId depuis placeId
    const placeRes = await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${gameId}`,
       { headers: { "Cookie": `.ROBLOSECURITY=${ROBLO_COOKIE}` } }); 
       const placeData = await placeRes.json(); 
       if (!Array.isArray(placeData) || placeData.length === 0 || !placeData[0].universeId) { 
        console.log("Place introuvable ou universeId manquant", placeData); 
        return res.status(404).json({ error: "Place introuvable ou universeId manquant" }); 
      } 
    const universeId = placeData[0].universeId;
    console.log("universID récupérer", universeId)

    // ⚠️ Important : le cookie doit appartenir au propriétaire du jeu
    if (!ROBLO_COOKIE) 
      return res.status(500).json({ error: "ROBLO_COOKIE non défini" });

    // 3️⃣ Récupérer CSRF token
    let csrfToken;
    try {
      const csrfRes = await fetch("https://auth.roblox.com/v2/logout", {
        method: "POST",
        headers: { "Cookie": `.ROBLOSECURITY=${ROBLO_COOKIE}` }
      });
      csrfToken = csrfRes.headers.get("x-csrf-token");
    } catch (err) {
      return res.status(500).json({ error: "Impossible de récupérer le CSRF token" });
    }
    if (!csrfToken) return res.status(500).json({ error: "CSRF token introuvable" });

    // 4️⃣ Créer le VIP server
    const vipRes = await fetch(`https://games.roblox.com/v1/games/${universeId}/vip-servers`, {
      method: "POST",
      headers: {
        "Cookie": `.ROBLOSECURITY=${ROBLO_COOKIE}`,
        "X-CSRF-TOKEN": csrfToken,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: `VIP Serv ${name}`, maxPlayers: 10 })
    });

    const vipData = await vipRes.json();
    console.log("Roblox VIP response:", vipData, vipRes.status);

    if (!vipRes.ok) {
      // ⚠️ Ne touche pas la balance si création échoue
      return res.status(vipRes.status).json({
        error: "Erreur création VIP server",
        details: vipData
      });
    }

    // 5️⃣ Déduire la balance UNIQUEMENT si succès
    await deductBalance(user.uid, amount, gameId);

    // ✅ Retour succès
    res.json({ status: 200, message: "Serveur VIP payé et créé !", server: vipData });

  } catch (err) {
    console.error("Erreur payServer:", err);
    res.status(500).json({ error: "Impossible d'effectuer le paiement ou créer le serveur" });
  }
});

app.post("/api/getBalance", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "Paramètre manquant : name" });

    const user = await getUserBalance(name);
    if (!user) return res.status(404).json({ error: "Utilisateur introuvable" });

    res.json({ robux: user.balance });
  } catch (err) {
    console.error("Erreur /api/getBalance :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});


// --- Lancement serveur ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`✅ Serveur en ligne sur le port ${PORT}`);
});
