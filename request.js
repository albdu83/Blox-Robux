const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const fetch = require("node-fetch"); // si Node < 18
const app = express();
app.use(cors());
app.use(express.json());


const jobs = {};

let ROBLO_COOKIE = null;
let lienavatar = null;
let PROXY_HOST = process.env.PROXY_HOST;
let PROXY_PASS = process.env.PROXY_PASS;
let PROXY_USER = process.env.PROXY_USER;
let PROXY_PORT = process.env.PROXY_PORT;

// --- SECRET_KEY TimeWall ---
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET
const SECRET_KEY = process.env.SECRET_KEY || "21b4dc719da5c227745e9d1f23ab1cc0";
const THEOREM_SECRET = process.env.THEOREM_SECRET || "6e5a9ccc2f7788d13bfce09e4c832c41ef6a97b3";
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK
if (!process.env.SECRET_KEY) throw new Error("SECRET_KEY manquant");
if (!process.env.RECAPTCHA_SECRET) throw new Error("RECAPTCHA_SECRET manquant");
if (!process.env.THEOREM_SECRET) throw new Error("THEOREM_SECRET manquant");
if (!DISCORD_WEBHOOK) throw new Error("DISCORD_WEBHOOK manquant");

const loginAttempts = {};

function logFailedAttempt(ip, username) {
  const key = `${ip}:${username}`;
  if (!loginAttempts[key]) loginAttempts[key] = [];
  loginAttempts[key].push(Date.now());
  console.log(`⚠️ Tentative de login échouée pour ${username} depuis ${ip}`);
}

function isRateLimited(ip, username) {
  const key = `${ip}:${username}`;
  if (!loginAttempts[key]) loginAttempts[key] = [];
  const now = Date.now();
  loginAttempts[key] = loginAttempts[key].filter(t => now - t < 60_000);
  if (loginAttempts[key].length >= 5) return true;
  loginAttempts[key].push(now);
  return false;
}


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
async function getRobloxAvatar(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
  });
  const data = await res.json();
  if (!data.data || !data.data.length) return null;

  const userId = data.data[0].id;

  const avatarRes = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
  );
  const avatarData = await avatarRes.json();

  return avatarData?.data?.[0]?.imageUrl || null;
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
        lienavatar = avatarData.data[0].imageUrl,
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
const { text } = require("stream/consumers");
const { error } = require("console");


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
    ),
    databaseURL: "https://bloxrobux-e9244-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

const db = admin.database();

// Charger le cookie en temps réel
db.ref("roblox/cookies/cookies/0/value").on("value", snap => {
  ROBLO_COOKIE = snap.val();
  console.log("🍪 ROBLO_COOKIE chargé :", !!ROBLO_COOKIE);
});

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

    const snapshot = await db.ref("users/" + uid).get();
    const data = snapshot.val()
    await txRef.set({ uid, amount, type, date: Date.now() });

    await db.ref(`users/${uid}/balance`)
      .transaction(v => (v || 0) + amount);

    await db.ref(`users/${uid}/robuxGagnes`)
      .transaction(v => (v || 0) + amount);  
    const avatarUrl = await getRobloxAvatar(userID);
    await fetch(`${DISCORD_WEBHOOK}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        embeds: [{
          title: `**${data.username}** a gagné **${amount} R$** !`,
          description: `félicitations à **${data.username}** qui a gagné **${amount} R$** en complétant une offre sur TimeWall`,
          color: 0x5865F2,
          thumbnail: {
            url: avatarUrl
          },
          image: {
            url: "https://i.imgur.com/G7f87gT.png"
          },
          footer: {
            text: "BloxRobux",
            icon_url: "https://i.imgur.com/PjcK6QD.png"
          },
          timestamp: new Date().toISOString()
        }]
      })
    });
    console.log(`✅ Crédité ${userID} (${uid}) +${amount}`);
    return res.status(200).send("OK");

  } catch (err) {
    console.error("🔥 TimeWall error:", err);
    return res.status(200).send("OK");
  }
});

app.post("/signup", async (req, res) => {
  const { username, password, RobloxName, captcha } = req.body;

  // 1️⃣ CAPTCHA côté serveur
  if (!captcha) {
    return res.status(400).json({ error: "Captcha manquant" });
  }

  try {
    const captchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${captcha}`,
      { method: "POST" }
    );
    const captchaData = await captchaRes.json();

    if (!captchaData.success) {
      return res.status(403).json({ error: "Captcha invalide" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Erreur de vérification captcha" });
  }

  // 2️⃣ Vérifications des champs
  if (!username || username.length < 3 || username.length > 20) {
    return res.status(400).json({ error: "Username invalide" });
  }

  if (!password || password.length < 8) {
    return res.status(400).json({ error: "Mot de passe trop court (au moins 8 caractères)" });
  }

  if (!RobloxName) {
    return res.status(400).json({ error: "RobloxName manquant" });
  }

  // 3️⃣ Vérification de l'existence du pseudo Roblox
  try {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usernames: [RobloxName], excludeBannedUsers: true })
    });
    const data = await response.json();

    if (!data?.data?.length) {
      return res.status(404).json({ error: "Pseudo Roblox inexistant" });
    }
  } catch (err) {
    return res.status(500).json({ error: "Erreur vérification Roblox" });
  }

  // 4️⃣ Création de l'email et utilisateur Firebase
  const email = `${username}@bloxrobux.local`;
  const usernameSnap = await db
    .ref("users")
    .orderByChild("username")
    .equalTo(username)
    .get();

  if (usernameSnap.exists()) {
    return res.status(409).json({ error: "Nom d'utilisateur déjà utilisé" });
  }
  try {
    const userRecord = await admin.auth().createUser({
      email,
      password
    });
    const uid = userRecord.uid;

    // 5️⃣ Stockage sécurisé dans la DB
    await db.ref("users/" + uid).set({
      email,
      username,
      firstUsername: username,
      RobloxName,
      balance: 0,
      createdAt: Date.now(), // timestamp serveur
      nbConnexions: 1,
      robuxGagnes: 0,
      isBanned: false
    });

    return res.status(201).json({ success: true, uid });
  } catch (err) {
    // Gestion des doublons / erreurs Firebase
    if (err.code === "auth/email-already-in-use") {
      return res.status(409).json({ error: "Nom d'utilisateur déjà pris" });
    }
    console.error(err);
    return res.status(500).json({ error: "Erreur création utilisateur" });
  }
});

app.post("/login", async (req, res) => {
  const { username, password, captcha } = req.body;

  /* ───────── 1️⃣ VALIDATIONS STRICTES ───────── */
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof captcha !== "string"
  ) {
    return res.status(400).json({ error: "Requête invalide" });
  }

  if (username.length < 3 || username.length > 20 || password.length < 8) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  /* ───────── 2️⃣ CAPTCHA (ANTI-BOT) ───────── */
  try {
    const captchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${captcha}`,
      { method: "POST" }
    );
    const captchaData = await captchaRes.json();

    if (!captchaData.success) {
      return res.status(403).json({ error: "Captcha invalide" });
    }
  } catch {
    return res.status(500).json({ error: "Erreur captcha" });
  }

  /* ───────── 3️⃣ RATE LIMIT ───────── */
  if (isRateLimited(req.ip, username)) {
    return res.status(429).json({
      error: "Trop de tentatives, réessaie plus tard"
    });
  }

  try {
    /* ───────── 4️⃣ RÉCUPÉRATION UTILISATEUR ───────── */
    const snap = await db
      .ref("users")
      .orderByChild("username")
      .equalTo(username)
      .get();

    if (!snap.exists()) {
      logFailedAttempt(req.ip, username);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const uid = Object.keys(snap.val())[0];
    const user = snap.val()[uid];

    /* ───────── 5️⃣ CONTRÔLES COMPTE ───────── */
    if (user.isBanned === true) {
      return res.status(403).json({ error: "Compte suspendu" });
    }

    if (!user.email) {
      return res.status(500).json({ error: "Compte corrompu" });
    }

    /* ───────── 6️⃣ VÉRIFICATION MOT DE PASSE (FIREBASE) ───────── */
    const fbRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: user.email,
          password,
          returnSecureToken: false
        })
      }
    );

    if (!fbRes.ok) {
      logFailedAttempt(req.ip, username);
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    /* ───────── 7️⃣ TOKEN FIREBASE CUSTOM ───────── */
    const customToken = await admin.auth().createCustomToken(uid);

    /* ───────── 8️⃣ STATS & CLEANUP ───────── */
    await db.ref(`users/${uid}`).update({
      lastLoginAt: Date.now()
    });

    await db
      .ref(`users/${uid}/nbConnexions`)
      .transaction(v => (v || 0) + 1);

    /* ───────── 9️⃣ RÉPONSE ───────── */
    return res.json({
      success: true,
      token: customToken
    });

  } catch (err) {
    console.error("🔥 Erreur login:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/getEmail", async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Username manquant" });

  try {
    // On récupère l'utilisateur par son username actuel
    const snapshot = await db.ref("users").orderByChild("username").equalTo(username).once("value");
    if (!snapshot.exists()) return res.status(404).json({ error: "Utilisateur introuvable" });

    const uid = Object.keys(snapshot.val())[0];
    const user = snapshot.val()[uid];

    // On utilise firstUsername pour construire l'email
    let email = user.email;
    if (!email && user.firstUsername) {
      email = `${user.firstUsername}@bloxrobux.local`;
      // Optionnel : on met à jour la DB pour que ce soit permanent
      await db.ref("users/" + uid).update({ email });
    }

    if (!email) return res.status(404).json({ error: "Email non défini pour cet utilisateur" });

    res.json({ email });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post('/api/roblox-user/:username', async (req, res) => {
    const username = req.params.username
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
    });
    const data = await response.json();
    res.json(data);
});

app.get("/reach", (req, res) => {
  console.log("🔥 /reach HIT", req.url);

  const { reward, user_id, tx_id, hash, reversal } = req.query;

  if (!reward || !user_id || !tx_id || !hash) {
    return res.status(200).send("OK");
  }

  if (reversal === "true") {
    return res.status(200).send("OK");
  }

  // ⚠️ UTILISER req.url
  const result = verifyTheoremReachHash(
    req.url,
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
const ADMIN_CODE = process.env.ADMIN_CODE;

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

app.get("/api/get-cookies", async (req, res) => {
  const snap = await db.ref("roblox/cookies").get();
  if (!snap.exists()) {
    return res.status(404).json({ error: "Aucun cookie stocké" });
  }
  res.json(snap.val());
});

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
  try {
    const { name, gameId } = req.body;

    const username = process.env.ROBLOX_USERNAME;
    const password = process.env.ROBLOX_PASSWORD;

    if (!name || !gameId) {
      return res.status(400).json({ success: false, error: "Paramètres manquants" });
    }

    // Générer un job_id unique
    const job_id = crypto.randomUUID();

    // Initialiser le job à pending
    jobs[job_id] = { status: "pending" };
    setTimeout(() => delete jobs[job_id], 24*60*60*1000);
    // Préparer payload pour GitHub
    const payload = {
      event_type: "run_selenium",
      client_payload: {
        username,
        password,
        server_name: name,
        callback_url: "https://blox-robux.onrender.com/callback", // ton endpoint callback
        secret: process.env.SELENIUM_SECRET,
        job_id,
        PROXY_HOST: PROXY_HOST,
        PROXY_PORT: PROXY_PORT,
        PROXY_USER: PROXY_USER,
        PROXY_PASS: PROXY_PASS
      }
    };
    console.log("🔹 Payload GitHub API:");
    console.log(JSON.stringify(payload, null, 2));
    // Appel API GitHub pour déclencher GitHub Actions
    const response = await fetch("https://api.github.com/repos/louscript21/TestBloxRobux/dispatches", {
      method: "POST",
      headers: {
        "Authorization": `token ${process.env.GITHUB_TOKEN}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Erreur GitHub API : ${response.status, text}`);
    }

    res.json({
      success: true,
      message: "Job lancé",
      job_id
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/callback", (req, res) => {
  const { job_id, status, secret, error } = req.body;

  if (secret !== process.env.SELENIUM_SECRET) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // Mettre à jour l'état du job
  if (jobs[job_id]) {
    jobs[job_id].status = status;
    if (error) jobs[job_id].error = error;
  }

  console.log(`Job ${job_id} terminé avec status: ${status}`);
  if (error) console.log(`Erreur: ${error}`);

  res.sendStatus(200);
});

app.get("/api/jobStatus", (req, res) => {
  const { job_id } = req.query;
  if (!job_id || !jobs[job_id]) {
    return res.status(404).json({ error: "Job introuvable" });
  }
  res.json(jobs[job_id]);
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
