const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const app = express();
const helmet = require("helmet");
const path = require("path");
const fs = require("fs/promises");
const admin = require("firebase-admin");
const { fileURLToPath } = require("url");
const cookieParser = require("cookie-parser");
app.use(cookieParser());
app.use(helmet());
app.set("trust proxy", 1);
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://www.bloxrbx.fr",
      "https://bloxrbx.fr",
      "https://il.bloxrbx.fr",
    ],
    credentials: true,
  }),
);
app.use(express.json());

const jobs = {};
let sseTokens = {};

let lienavatar = null;

// --- SECRET_KEYS ---
const RECAPTCHA_SECRET = process.env.RECAPTCHA_SECRET;
const SECRET_KEY = process.env.SECRET_KEY;
const THEOREM_SECRET = process.env.THEOREM_SECRET;
const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK;
const DISCORD_WEBHOOK_TRACKER = process.env.DISCORD_WEBHOOK_TRACKER;
const CPX_SECRET = process.env.CPX_SECRET;
if (!SECRET_KEY) throw new Error("SECRET_KEY manquant");
if (!CPX_SECRET) throw new Error("CPX_SECRET manquant");
if (!RECAPTCHA_SECRET) throw new Error("RECAPTCHA_SECRET manquant");
if (!THEOREM_SECRET) throw new Error("THEOREM_SECRET manquant");
if (!DISCORD_WEBHOOK) throw new Error("DISCORD_WEBHOOK manquant");
if (!DISCORD_WEBHOOK_TRACKER)
  throw new Error("DISCORD_WEBHOOK_TRACKER manquant");

const queue = [];
let processing = false;

function verifyCsrf(req, res, next) {
  const token = req.headers["x-csrf-token"];

  if (!token) {
    return res.status(403).json({ error: "CSRF manquant" });
  }

  if (!global.csrfTokens || !global.csrfTokens.has(token)) {
    return res.status(403).json({ error: "CSRF invalide" });
  }

  // option sécurité extra: one-time use
  global.csrfTokens.delete(token);

  next();
}

async function getAllUsersCount(nextPageToken = undefined, total = 0) {
  const result = await admin.auth().listUsers(1000, nextPageToken);

  total += result.users.length;

  const next = result.pageToken;

  if (next) {
    return getAllUsersCount(next, total);
  }

  return total;
}

async function getTotalRobuxGagnes() {
  const snap = await db.ref("users").get();

  if (!snap.exists()) return 0;

  let total = 0;

  snap.forEach((child) => {
    const data = child.val();
    total += Number(data.robuxGagnes || 0);
  });

  return total;
}

function sendWebhook(payload, webhook = DISCORD_WEBHOOK) {
  queue.push({ payload, webhook, retries: 0 });
  console.log("📦 Queue size:", queue.length);
  processQueue();
}

async function processQueue() {
  if (processing || queue.length === 0) return;
  processing = true;

  while (queue.length > 0) {
    const job = queue.shift();
    console.log(`🚀 Traitement d'un job, queue restante: ${queue.length}`);

    try {
      // petit délai anti-spam Discord
      await new Promise((r) => setTimeout(r, 300));

      const res = await fetch(job.webhook, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "Mozilla/5.0 (Node.js Bot)",
        },
        body: JSON.stringify(job.payload),
      });

      const contentType = res.headers.get("content-type") || "";

      /* ───────── 1️⃣ RATE LIMIT DISCORD / CLOUDFLARE ───────── */
      if (res.status === 429 || res.status === 403) {
        let waitTime = 5000; // fallback

        try {
          if (contentType.includes("application/json")) {
            const data = await res.json();
            waitTime = data.retry_after || waitTime;

            console.log(`🔁 Rate limit reçu → attendre ${waitTime}ms`);
          } else {
            const text = await res.text();

            if (
              text.includes("1015") ||
              text.toLowerCase().includes("rate limited")
            ) {
              console.warn("🚫 Cloudflare rate limit → attente 10s");
              waitTime = 10000;
            } else {
              console.warn("⚠️ Réponse non JSON :", text.slice(0, 200));
            }
          }
        } catch (err) {
          console.warn("⚠️ Erreur parsing réponse :", err.message);
        }

        job.retries = (job.retries || 0) + 1;

        if (job.retries <= 5) {
          setTimeout(() => {
            queue.unshift(job);
            processQueue();
          }, waitTime);
        } else {
          console.error(`❌ Job abandonné après ${job.retries} retries`);
        }

        continue;
      }

      /* ───────── 2️⃣ AUTRES ERREURS HTTP ───────── */
      if (!res.ok) {
        console.error(`❌ Webhook failed: ${res.status}`);

        job.retries = (job.retries || 0) + 1;

        if (job.retries <= 5) {
          const delay = Math.min(1000 * 2 ** (job.retries - 1), 60000);
          console.log(`🔁 Retry ${job.retries}/5 après ${delay}ms`);

          setTimeout(() => {
            queue.unshift(job);
            processQueue();
          }, delay);
        } else {
          console.error(`❌ Job abandonné après ${job.retries} retries`);
        }

        continue;
      }

      /* ───────── 3️⃣ SUCCESS ───────── */
      console.log("✅ Webhook envoyé avec succès");
    } catch (err) {
      console.error(`🔥 Error: ${err.message}`);

      job.retries = (job.retries || 0) + 1;

      if (job.retries <= 5) {
        const delay = Math.min(1000 * 2 ** (job.retries - 1), 60000);
        console.log(`🔁 Retry ${job.retries}/5 après ${delay}ms`);

        setTimeout(() => {
          queue.unshift(job);
          processQueue();
        }, delay);
      } else {
        console.error(`❌ Job échoué après ${job.retries} retries`);
      }
    }
  }

  processing = false;
}

// Ajouter un job à la queue
function addJob(job) {
  queue.push(job);
  processQueue();
}

module.exports = { addJob, processQueue };

const loginAttempts = {};

async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) return res.status(401).send("Token manquant");

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    req.user = { uid: decoded.uid };
    next();
  } catch (err) {
    console.error("Erreur verifyIdToken:", err.message);
    res.status(401).send("Token invalide");
  }
}

function logFailedAttempt(ip, username) {
  const key = `${ip}:${username}`;
  if (!loginAttempts[key]) loginAttempts[key] = [];
  loginAttempts[key].push(Date.now());
  console.log(`⚠️ Tentative de login échouée pour ${username} depuis ${ip}`);
}

const trackerCooldown = new Map();

const delayMap = new Map();

function getLoginDelay(ip) {
  const attempts = delayMap.get(ip) || 0;
  delayMap.set(ip, attempts + 1);
  return Math.min(5000 * attempts, 30000); // max 30s
}

async function StatList(message, key = "Erreur fatale ou iconnue") {
  try {
    const now = Date.now();

    // ⏱️ Anti-spam (1 message / 30s par clé)
    if (trackerCooldown.has(key)) {
      if (now - trackerCooldown.get(key) < 5_000) return;
    }
    trackerCooldown.set(key, now);

    // 🧼 Nettoyage anti-mention Discord
    const safeMessage = message.replace(/@/g, "@\u200b").slice(0, 1800); // limite Discord

    sendWebhook(
      {
        embeds: [
          {
            title: "🚨 Tentative de connexion échouée ou bloquée",
            description: safeMessage,
            color: 0x992d22,
            footer: {
              text: "BloxRobux Security",
              icon_url: "https://i.imgur.com/PjcK6QD.png",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      },
      DISCORD_WEBHOOK_TRACKER,
    );
  } catch (err) {
    console.error("Tracker Discord erreur :", err.message);
  }
}

const attempts = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [key, data] of attempts) {
    if (now - data.first > 5 * 60_000) attempts.delete(key);
  }
}, 60_000);

/**
 * Vérifie si un utilisateur ou une IP est en limite de tentative
 * @param {string} ip - IP du client
 * @param {string} username - username tenté
 * @returns {boolean} true si limité, false sinon
 */
function isRateLimited(ip, username) {
  const now = Date.now();

  // --- Limite globale par IP ---
  const ipKey = `ip:${ip}`;
  let ipData = attempts.get(ipKey) || { count: 0, first: now };

  // Reset après 5 minutes
  if (now - ipData.first > 5 * 60_000) {
    ipData.count = 0;
    ipData.first = now;
  }

  ipData.count++;
  attempts.set(ipKey, ipData);

  if (ipData.count > 10) {
    // max 10 tentatives / 5 min par IP
    return true;
  }

  // --- Limite spécifique IP + username ---
  const ipUserKey = `ip-user:${ip}:${username}`;
  let ipUserData = attempts.get(ipUserKey) || { count: 0, first: now };

  if (now - ipUserData.first > 5 * 60_000) {
    ipUserData.count = 0;
    ipUserData.first = now;
  }

  ipUserData.count++;
  attempts.set(ipUserKey, ipUserData);

  if (ipUserData.count > 5) {
    // max 5 tentatives / 5 min par IP+username
    return true;
  }

  // --- Tout est OK ---
  return false;
}

function verifyTheoremReachHash(req, secret) {
  // URL complète (protocole + host + path + query)
  const fullUrl = `${req.protocol}://${req.get("host")}${req.originalUrl}`;

  const hashIndex = fullUrl.lastIndexOf("&hash=");
  if (hashIndex === -1) {
    return { valid: false, reason: "hash missing" };
  }

  const urlToSign = fullUrl.substring(0, hashIndex);
  const receivedHash = fullUrl.substring(hashIndex + 6);

  const computedHash = crypto
    .createHmac("sha1", secret)
    .update(urlToSign, "utf8")
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  return {
    valid: computedHash === receivedHash,
    urlToSign,
    computedHash,
    receivedHash,
  };
}

async function getRobloxAvatar(username) {
  const res = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  const data = await res.json();
  if (!data.data || !data.data.length) return null;

  const userId = data.data[0].id;

  const avatarRes = await fetch(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
  );
  const avatarData = await avatarRes.json();

  return avatarData?.data?.[0]?.imageUrl || null;
}

// --- Endpoint Roblox avatar ---
app.get("/api/avatar/:username", async (req, res) => {
  const username = req.params.username;

  try {
    const response = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [username],
          excludeBannedUsers: true,
        }),
      },
    );

    const data = await response.json();
    if (!data.data || data.data.length === 0)
      return res.status(404).json({ error: "Utilisateur introuvable" });

    const userId = data.data[0].id;

    const avatarRes = await fetch(
      `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`,
    );

    const avatarData = await avatarRes.json();
    if (!avatarData.data || avatarData.data.length === 0)
      return res.status(500).json({ error: "Erreur avatar Roblox" });
    ((lienavatar = avatarData.data[0].imageUrl),
      res.json({
        avatarUrl: avatarData.data[0].imageUrl,
        targetId: userId,
      }));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// --- Endpoint TimeWall ---

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT),
    ),
    databaseURL:
      "https://blox-robux-officiel-default-rtdb.europe-west1.firebasedatabase.app",
  });
}

const db = admin.database();

app.get("/timewall", async (req, res) => {
  const { userID, transactionID, currencyAmount, revenue, hash, type } =
    req.query;
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
        expected: computedHash,
      });
      return res.status(200).send("OK");
    }

    // ✅ Solde = currencyAmount
    let amount = Math.ceil(Number(currencyAmount));

    if (amount <= 0) {
      console.log("❌ Amount invalide :", currencyAmount);
      return res.status(200).send("OK");
    }

    const snap2 = await db.ref("settings").get();

    if (!snap2.exists()) {
      console.error("❌ Erreur fatale : settings manquant");
      return res.status(500).send("Settings missing");
    }

    const settings = snap2.val();
    const multiplier = Number(settings.gainMultiplier) || 1;

    amount = Math.round(amount * multiplier);

    // 🔎 Récupération UID Firebase via RobloxName
    const snap = await db
      .ref("users")
      .orderByChild("firstUsername")
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
    const data = snapshot.val();
    await txRef.set({ uid, amount, type, date: Date.now() });

    await db.ref(`users/${uid}/balance`).transaction((v) => (v || 0) + amount);

    await db
      .ref(`users/${uid}/robuxGagnes`)
      .transaction((v) => (v || 0) + amount);
    const avatarUrl = await getRobloxAvatar(data.RobloxName);
    sendWebhook({
      embeds: [
        {
          title: `**${data.username}** a gagné **${amount} R$** !`,
          description: `félicitations à **${data.username}** qui a gagné **${amount} R$** en complétant une offre sur TimeWall`,
          color: 0x5865f2,
          thumbnail: {
            url: avatarUrl,
          },
          image: {
            url: "https://i.imgur.com/1t5wioe.png",
          },
          footer: {
            text: "BloxRobux",
            icon_url: "https://i.imgur.com/PjcK6QD.png",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });
    console.log(`✅ Crédité ${userID} (${uid}) +${amount}`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 TimeWall error:", err);
    return res.status(200).send("OK");
  }
});
//---------------------------------------------------------------------------------------------------------------------------//
app.get("/cpx", async (req, res) => {
  const { status, trans_id, user_id, amount_local, amount_usd, hash } =
    req.query;
  console.log("🔥 /CPX HIT", req.query);

  try {
    if (!status || !trans_id || !user_id || !amount_usd || !hash) {
      console.log("❌ Paramètres manquants");
      return res.status(200).send("OK");
    }

    if (status !== "1") {
      console.log("⚠️ Status non approuvé :", status);
      return res.status(200).send("OK");
    }

    const expectedHash = crypto
      .createHash("md5")
      .update(`${trans_id}-${CPX_SECRET}`)
      .digest("hex");

    if (expectedHash !== hash) {
      console.log("❌ Hash invalide", {
        user_id,
        amount_usd,
        received: hash,
        expected: expectedHash,
      });
      return res.status(200).send("OK");
    }

    // ✅ Solde = currencyAmount
    let amount = Math.ceil(Number(amount_local));

    if (amount <= 0) {
      console.log("❌ Amount invalide :", amount_local);
      return res.status(200).send("OK");
    }

    const snap2 = await db.ref("settings").get();

    if (!snap2.exists()) {
      console.error("❌ Erreur fatale : settings manquant");
      return res.status(500).send("Settings missing");
    }

    const settings = snap2.val();
    const multiplier = Number(settings.gainMultiplier) || 1;

    amount = Math.round(amount * multiplier);

    // 🔎 Récupération UID Firebase via RobloxName
    const snap = await db
      .ref("users")
      .orderByChild("firstUsername")
      .equalTo(user_id)
      .get();

    if (!snap.exists()) {
      console.log("❌ Utilisateur Firebase introuvable");
      return res.status(200).send("OK");
    }

    const uid = Object.keys(snap.val())[0];

    // 🔒 Anti-doublon
    const txRef = db.ref("transactions/" + trans_id);
    if ((await txRef.get()).exists()) {
      console.log("⚠️ Transaction déjà traitée");
      return res.status(200).send("OK");
    }
    const source = "cpx";
    const snapshot = await db.ref("users/" + uid).get();
    const data = snapshot.val();
    await txRef.set({ uid, amount, source, date: Date.now() });

    await db.ref(`users/${uid}/balance`).transaction((v) => (v || 0) + amount);

    await db
      .ref(`users/${uid}/robuxGagnes`)
      .transaction((v) => (v || 0) + amount);
    const avatarUrl = await getRobloxAvatar(data.RobloxName);
    sendWebhook({
      embeds: [
        {
          title: `**${data.username}** a gagné **${amount} R$** !`,
          description: `félicitations à **${data.username}** qui a gagné **${amount} R$** en complétant une offre sur CPX Research`,
          color: 0x5865f2,
          thumbnail: {
            url: avatarUrl,
          },
          image: {
            url: "https://i.imgur.com/qT78ezf.png",
          },
          footer: {
            text: "BloxRobux",
            icon_url: "https://i.imgur.com/PjcK6QD.png",
          },
          timestamp: new Date().toISOString(),
        },
      ],
    });

    console.log(`✅ Crédité ${user_id} (${uid}) +${amount}`);
    return res.status(200).send("OK");
  } catch (err) {
    console.error("🔥 TimeWall error:", err);
    return res.status(200).send("OK");
  }
});

//---------------------------------------------------------------------------------------------------------------------------//

app.post("/CPXHASH", async (req, res) => {
  const { firstUsername } = req.body;
  const user_id = firstUsername;
  // Génération du secure_hash
  const app_id = "26353";
  const secure_hash = crypto
    .createHash("sha256")
    .update(app_id + user_id + CPX_SECRET)
    .digest("hex");

  // URL iframe à envoyer au front
  const iframeUrl = `https://offers.cpx-research.com/index.php?app_id=${app_id}&ext_user_id=${user_id}&secure_hash=${secure_hash}`;
  return res.status(200).json({ iframeUrl });
});

//---------------------------------------------------------------------------------------------------------------------------//
app.get("/getCsrfToken", (req, res) => {
  const token = crypto.randomBytes(32).toString("hex");

  // optionnel : stockage mémoire court terme (anti-replay léger)
  if (!global.csrfTokens) global.csrfTokens = new Set();
  global.csrfTokens.add(token);

  setTimeout(() => global.csrfTokens.delete(token), 10 * 60 * 1000); // 10 min

  res.json({ token });
});

app.post("/signup", verifyCsrf, async (req, res) => {
  const { username, password, RobloxName, captcha } = req.body;

  // 1️⃣ CAPTCHA côté serveur
  if (!captcha) {
    return res.status(400).json({ error: "Captcha manquant" });
  }

  try {
    const captchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${captcha}`,
      { method: "POST" },
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
    return res
      .status(400)
      .json({ error: "Mot de passe trop court (au moins 8 caractères)" });
  }

  if (!RobloxName) {
    return res.status(400).json({ error: "RobloxName manquant" });
  }

  // 3️⃣ Vérification de l'existence du pseudo Roblox
  try {
    const response = await fetch(
      "https://users.roblox.com/v1/usernames/users",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: [RobloxName],
          excludeBannedUsers: true,
        }),
      },
    );
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
      password,
    });
    const uid = userRecord.uid;

    const customToken = await admin.auth().createCustomToken(uid);
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
      isBanned: false,
    });

    return res.status(201).json({ success: true, uid, customToken });
  } catch (err) {
    // Gestion des doublons / erreurs Firebase
    if (err.code === "auth/email-already-in-use") {
      return res.status(409).json({ error: "Nom d'utilisateur déjà pris" });
    }
    console.error(err);
    return res.status(500).json({ error: "Erreur création utilisateur" });
  }
});

app.post("/login", verifyCsrf, async (req, res) => {
  const { username, password, captcha } = req.body;

  /* ───────── 1️⃣ VALIDATIONS STRICTES ───────── */
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    typeof captcha !== "string"
  ) {
    StatList(
      `Erreur lors du saisie des informations\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
    );
    return res.status(400).json({ error: "Requête invalide" });
  }

  if (username.length < 3 || username.length > 20 || password.length < 8) {
    return res.status(401).json({ error: "Identifiants invalides" });
  }

  /* ───────── 2️⃣ CAPTCHA (ANTI-BOT) ───────── */
  try {
    const captchaRes = await fetch(
      `https://www.google.com/recaptcha/api/siteverify?secret=${RECAPTCHA_SECRET}&response=${captcha}`,
      { method: "POST" },
    );
    const captchaData = await captchaRes.json();

    if (!captchaData.success) {
      StatList(
        `Captcha invalide\n\n👤 Username : ${username}\n🌍 IP: : ${req.ip}`,
        `IP:${req.ip}`,
      );
      return res.status(403).json({ error: "Captcha invalide" });
    }
  } catch {
    StatList(
      `Erreur Captcha inconnue\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
    );
    return res.status(500).json({ error: "Erreur captcha" });
  }

  /* ───────── 3️⃣ RATE LIMIT ───────── */
  if (isRateLimited(req.ip, username)) {
    StatList(
      `@🛡️ Propriétaire Rate limit déclenché\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
      `ratelimit:${req.ip}`,
    );
    return res.status(429).json({
      error: "Trop de tentatives, réessaie plus tard",
    });
  }

  try {
    const delay = getLoginDelay(req.ip);
    await new Promise((r) => setTimeout(r, delay));
    /* ───────── 4️⃣ RÉCUPÉRATION UTILISATEUR ───────── */
    const snap = await db
      .ref("users")
      .orderByChild("username")
      .equalTo(username)
      .get();

    if (!snap.exists()) {
      logFailedAttempt(req.ip, username);
      StatList(
        `Un utilisateur a tenté de se connecter à un **compte inexistant**\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
        `IP:${req.ip}`,
      );
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    const uid = Object.keys(snap.val())[0];
    const user = snap.val()[uid];

    /* ───────── 5️⃣ CONTRÔLES COMPTE ───────── */
    if (user.isBanned === true) {
      StatList(
        `Un utilisateur a tenté de se connecter à un **compte banni**\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
        `banned:${username}`,
      );
      return res.status(403).json({ error: "Compte suspendu" });
    }

    if (!user.email) {
      StatList(
        `Compte corrompu\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
        `Compte:${username}`,
      );
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
          returnSecureToken: false,
        }),
      },
    );

    if (!fbRes.ok) {
      logFailedAttempt(req.ip, username);
      StatList(
        `Erreur fatale lors de la connexion\n\n👤 Username : ${username}\n🌍 IP : ${req.ip}`,
      );
      return res.status(401).json({ error: "Identifiants invalides" });
    }

    /* ───────── 7️⃣ TOKEN FIREBASE CUSTOM ───────── */
    const customToken = await admin.auth().createCustomToken(uid);

    /* ───────── 8️⃣ STATS & CLEANUP ───────── */
    await db.ref(`users/${uid}`).update({
      lastLoginAt: Date.now(),
    });

    await db.ref(`users/${uid}/nbConnexions`).transaction((v) => (v || 0) + 1);

    /* ───────── 9️⃣ WEBHOOK ───────── */
    try {
      sendWebhook(
        {
          embeds: [
            {
              title: "✅ Tentative de connexion réussi",
              description: `Connexion réussi pour le compte ${username}`,
              color: 0xc27c0e,
              footer: {
                text: "BloxRobux Security",
                icon_url: "https://i.imgur.com/PjcK6QD.png",
              },
              timestamp: new Date().toISOString(),
            },
          ],
        },
        DISCORD_WEBHOOK_TRACKER,
      );
    } catch (err) {
      console.error("Tracker Discord erreur :", err.message);
    }

    /* ───────── 🔟 RÉPONSE ───────── */
    return res.json({
      success: true,
      token: customToken,
    });
  } catch (err) {
    console.error("🔥 Erreur login:", err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/getEmail", authenticate, verifyCsrf, async (req, res) => {
  const username = req.query.username;
  if (!username) return res.status(400).json({ error: "Username manquant" });

  try {
    // On récupère l'utilisateur par son username actuel
    const snapshot = await db
      .ref("users")
      .orderByChild("username")
      .equalTo(username)
      .once("value");
    if (!snapshot.exists())
      return res.status(404).json({ error: "Utilisateur introuvable" });

    const uid = Object.keys(snapshot.val())[0];
    const user = snapshot.val()[uid];

    // On utilise firstUsername pour construire l'email
    let email = user.email;
    if (!email && user.firstUsername) {
      email = `${user.firstUsername}@bloxrobux.local`;
      // Optionnel : on met à jour la DB pour que ce soit permanent
      await db.ref("users/" + uid).update({ email });
    }

    if (!email)
      return res
        .status(404)
        .json({ error: "Email non défini pour cet utilisateur" });

    res.json({ email });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/roblox-user/:username", async (req, res) => {
  const username = req.params.username;
  const response = await fetch("https://users.roblox.com/v1/usernames/users", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usernames: [username], excludeBannedUsers: true }),
  });
  const data = await response.json();
  res.json(data);
});

app.get("/reach", async (req, res) => {
  console.log("🔥 /reach HIT", req.originalUrl);
  const { user_id, reward, tx_id, debug, reversal } = req.query;

  // Toujours répondre 200 à Reach
  const OK = () => res.status(200).send("OK");

  // Paramètres minimum requis
  if (!user_id || !reward || !tx_id) {
    console.log("❌ paramètres manquants");
    return OK();
  }

  // 🔐 Vérification du hash AVANT TOUT
  const result = verifyTheoremReachHash(req, THEOREM_SECRET);

  console.log("RAW QUERY :", result.queryString);
  console.log("HASH CALCULÉ :", result.computedHash);
  console.log("HASH REÇU    :", result.receivedHash);

  if (!result.valid) {
    console.log("❌ HASH INVALIDE");
    return OK();
  }

  console.log("✅ HASH VALIDE");

  // 🧪 Debug → on ignore totalement
  if (debug === "true") {
    console.log("🧪 DEBUG CALLBACK → ignoré");
    return OK();
  }

  // 🔁 Reversal → on ignore (ou logique de retrait si tu veux)
  if (reversal === "true") {
    console.log("↩️ REVERSAL → ignoré");
    return OK();
  }

  // 💰 Conversion reward
  let amount = Math.round(parseFloat(reward) || 0);
  if (amount <= 0) {
    console.log("❌ reward invalide :", reward);
    return OK();
  }

  // 🔒 Anti-doublon tx_id (exemple simple)
  const txSnap = await db.ref(`transactions/${tx_id}`).get();
  if (txSnap.exists()) {
    console.log("⚠️ tx_id déjà traité");
    return OK();
  }

  // 🔎 Récupération utilisateur (exemple RobloxName)
  const snap = await db
    .ref("users")
    .orderByChild("firstUsername")
    .equalTo(user_id)
    .get();

  if (!snap.exists()) {
    console.log("❌ utilisateur introuvable :", user_id);
    return OK();
  }

  const snap2 = await db.ref("settings").get();

  if (!snap2.exists()) {
    console.error("❌ Erreur fatale : settings manquant");
    return res.status(500).send("Settings missing");
  }

  const settings = snap2.val();
  const multiplier = Number(settings.gainMultiplier) || 1;

  amount = Math.round(amount * multiplier);

  const uid = Object.keys(snap.val())[0];
  const data = snap.val()[uid];

  // 💾 Enregistrement transaction
  await db.ref(`transactions/${tx_id}`).set({
    uid,
    amount,
    source: "theoremreach",
    date: Date.now(),
  });

  // 💸 Crédit utilisateur
  await db.ref(`users/${uid}/balance`).transaction((v) => (v || 0) + amount);

  await db
    .ref(`users/${uid}/robuxGagnes`)
    .transaction((v) => (v || 0) + amount);

  console.log(`✅ ${user_id} crédité +${amount} | tx:${tx_id}`);
  const avatarUrl = await getRobloxAvatar(data.RobloxName);
  sendWebhook({
    embeds: [
      {
        title: `**${data.username}** a gagné **${amount} R$** !`,
        description: `félicitations à **${data.username}** qui a gagné **${amount} R$** en complétant une offre sur Theoreme Reach`,
        color: 0x5865f2,
        thumbnail: {
          url: avatarUrl,
        },
        image: {
          url: "https://i.imgur.com/RuBfCsu.png",
        },
        footer: {
          text: "BloxRobux",
          icon_url: "https://i.imgur.com/PjcK6QD.png",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  });
  return OK();
});

app.post("/checkAdminCode", verifyCsrf, async (req, res) => {
  const userCode = req.body.code;

  try {
    const snap = await db.ref("admin/code").get();
    const correctCode = snap.val();

    if (userCode === correctCode) {
      return res.status(200).json({ success: true });
    } else {
      return res.status(401).json({ success: false });
    }
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Erreur serveur" });
  }
});

app.get("/api/places", async (req, res) => {
  const { targetId } = req.query;

  try {
    if (!targetId) {
      return res.status(400).json({ error: "userId manquant" });
    }

    const placesRes = await fetch(
      `https://games.roblox.com/v2/users/${targetId}/games?accessFilter=Public`,
    );

    if (!placesRes.ok) {
      return res.status(placesRes.status).json({
        error: "Erreur API Roblox",
      });
    }

    const data = await placesRes.json();

    // On renvoie uniquement ce qui est utile au front
    const formatted = {
      data: data.data
        .map((game) => ({
          name: game.name,
          ID: game.id || null,
          RootID: game.rootPlace?.id || null,
        }))
        .filter((game) => game.RootID !== null)
        .filter((game) => game.ID !== null),
    };

    res.json(formatted);
  } catch (err) {
    console.error("Erreur récupération places :", err);
    res.status(500).json({ error: "Impossible de récupérer les emplacements" });
  }
});

async function getUserBalance(RobloxName) {
  const snap = await db
    .ref("users")
    .orderByChild("RobloxName")
    .equalTo(RobloxName)
    .get();
  if (!snap.exists()) return null;
  const uid = Object.keys(snap.val())[0];
  return { uid, balance: snap.val()[uid].balance || 0 };
}

app.post("/api/payServer", authenticate, async (req, res) => {
  try {
    const { name, ID, gameId, amount } = req.body;

    const userGamesRes = await fetch(
      `https://games.roblox.com/v2/users/${ID}/games?accessFilter=Public`,
    );
    const userGames = await userGamesRes.json();
    const validGameIds = (userGames.data || [])
      .map((game) => game.rootPlace?.id)
      .filter(Boolean);

    if (!validGameIds.includes(Number(gameId))) {
      return res
        .status(400)
        .json({ success: false, error: "Game ID invalide" });
    }

    if (!name || !gameId) {
      return res
        .status(400)
        .json({ success: false, error: "Paramètres manquants" });
    }

    const num = Number(amount);

    if (isNaN(num)) {
      throw new Error("Amount invalide");
    }

    const Price = Math.round(num / 0.7);

    // Générer un job_id unique
    const job_id = crypto.randomUUID();

    // Initialiser le job à pending
    jobs[job_id] = {
      status: "pending",
      error: null,
      updatedAt: Date.now(),
    };
    setTimeout(() => delete jobs[job_id], 24 * 60 * 60 * 1000);
    // Préparer payload pour le VPS
    fetch("http://87.106.245.156:5000/run_job", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: process.env.SELENIUM_SECRET,
        username: process.env.ROBLOX_USERNAME,
        password: process.env.ROBLOX_PASSWORD,
        server_url: `https://www.roblox.com/games/${gameId}`,
        Receive_price: amount,
        job_id,
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        console.log("Job envoyé", data);
      })
      .catch((err) => {
        console.error("VPS error", err);

        // 🔥 important : mark job failed
        if (jobs[job_id]) {
          jobs[job_id].status = "failed";
          jobs[job_id].error = "VPS unreachable";
        }
      });

    res.json({
      success: true,
      message: "Job lancé",
      job_id,
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
  } else {
    console.log("Job inconnu:", job_id);
    return res.sendStatus(404);
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

app.get("/getmultiplier", async (req, res) => {
  try {
    const snap = await db.ref("settings").get();
    if (!snap.exists())
      return res.status(404).json({ error: "Settings introuvables" });

    const settings = snap.val();
    const multiplier = Number(settings.gainMultiplier) || 1;

    res.json({ multiplier });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/getBalance", async (req, res) => {
  try {
    const { name, Montant } = req.body;
    if (!name)
      return res.status(400).json({ error: "Paramètre manquant : name" });

    const user = await getUserBalance(name);
    if (!user)
      return res.status(404).json({ error: "Utilisateur introuvable" });
    if (user.balance < Number(Montant))
      return res.status(400).json({ error: "Solde insuffisant" });
    res.json({ robux: user.balance });
  } catch (err) {
    console.error("Erreur /api/getBalance :", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

app.post("/api/withdraw", authenticate, async (req, res) => {
  const uid = req.user.uid;

  const snap = await db.ref("users/" + uid).get();
  const userData = snap.val();
  const balance = userData.balance || 0;

  const { amount } = req.body;
  if (!amount) return res.status(400).json({ error: "Paramètres manquants" });
  if (amount < 25 || amount > 375)
    return res.status(400).json({ error: "Montant invalide" });
  if (amount > balance)
    return res.status(400).json({ error: "Solde insuffisant" });

  const newBalance = balance - amount;
  await db.ref("users/" + uid).transaction((user) => {
    if (!user) return user;

    const newTransaction = {
      id: Date.now(),
      type: "withdraw",
      amount: -amount,
      date: new Date().toISOString(),
    };

    user.balance = (user.balance || 0) - amount;
    user.transactions = [...(user.transactions || []), newTransaction];

    return user;
  });

  // Juste pour info : renvoyer le solde actuel
  res.json({ newTransaction });
});

app.get("/api/sse/balance", async (req, res) => {
  const sseToken = req.cookies.sse_token;
  if (!sseToken || !sseTokens[sseToken]) {
    return res.status(403).send("Forbidden");
  }

  const { uid } = sseTokens[sseToken];
  const userRef = admin.database().ref(`users/${uid}`);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  let lastBalance = 0;

  // 🔹 Envoi initial
  const snapshot = await userRef.get();
  const data = snapshot.val() || { balance: 0 };
  lastBalance = data.balance || 0;
  res.write(`data: ${JSON.stringify({ ...data, delta: 0 })}\n\n`);

  // 🔹 Listener Firebase en temps réel
  const listener = userRef.on("value", (snapshot) => {
    const data = snapshot.val() || { balance: 0 };
    const balance = data.balance || 0;
    const delta = balance - lastBalance;
    lastBalance = balance;
    res.write(`data: ${JSON.stringify({ ...data, delta })}\n\n`);
  });

  // 🔹 Keep-alive ping toutes les 20s
  const keepAlive = setInterval(() => res.write(": ping\n\n"), 20000);

  // 🔹 Cleanup si client ferme la connexion
  req.on("close", () => {
    userRef.off("value", listener);
    clearInterval(keepAlive);
    res.end();
  });
});

app.post("/discord/statuemessage", async (req, res) => {
  const { statue } = req.body;
  try {
    await db.ref("settings/MessageContext").update({
      messageEnabled: statue,
    });

    res.status(200).json("OK");
  } catch (err) {
    res.status(500).json(err);
  }
});

app.post("/discord/annouce", async (req, res) => {
  const { title, content } = req.body;
  try {
    await db.ref("settings/MessageContext").update({
      Titre: title,
      Contexte: content,
    });

    res.status(200).json("OK");
  } catch (err) {
    res.status(500).json(err);
  }
});

app.get("/discord/getannounce", async (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  res.flushHeaders();

  const count = await getAllUsersCount();
  const Robux = await getTotalRobuxGagnes();

  const settingsref = admin.database().ref("settings/MessageContext");

  // 🔹 Envoi initial immédiat
  settingsref.once("value").then((snapshot) => {
    const data = snapshot.val() || {
      Titre: null,
      Contexte: null,
      messageEnabled: false,
    };
    res.write(`data: ${JSON.stringify({ ...data, count, Robux })}\n\n`);
  });

  // 🔹 Listener pour les changements suivants
  const listener = settingsref.on("value", (snapshot) => {
    const data = snapshot.val() || {
      Titre: null,
      Contexte: null,
      messageEnabled: false,
    };
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  });

  // keep-alive pour éviter timeout sur certains hébergeurs
  const keepAlive = setInterval(() => {
    res.write(": keep-alive\n\n");
  }, 20000);

  req.on("close", () => {
    settingsref.off("value", listener);
    clearInterval(keepAlive);
    res.end();
  });
});

app.post("/setSseCookie", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).send("Missing refresh token");

  try {
    // Vérifier le refresh token Firebase
    const user = await admin.auth().verifyIdToken(refreshToken); // ou custom verification
    const sseToken = crypto.randomBytes(32).toString("hex");

    // Stocker en mémoire ou DB temporaire
    sseTokens[sseToken] = {
      uid: user.uid,
      expires: Date.now() + 24 * 60 * 60 * 1000, // 24h
    };

    // Créer le cookie HTTP Only + Secure
    res.cookie("sse_token", sseToken, {
      httpOnly: true,
      secure: true,
      sameSite: "Lax",
      maxAge: 24 * 60 * 60 * 1000,
      domain: ".bloxrbx.fr",
    });

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: "Invalid refresh token" });
  }
});

app.post("/apply-promo", authenticate, async (req, res) => {
  try {
    const { username, code } = req.body;
    const snapshot = await db
      .ref("users")
      .orderByChild("username")
      .equalTo(username)
      .once("value");
    if (!snapshot.exists())
      return res.status(404).json({ error: "Utilisateur introuvable" });

    const uid = Object.keys(snapshot.val())[0];

    const ref = admin.database().ref(`promocodes/${code}`);
    const snap = await ref.get();

    if (!snap.exists()) return res.status(400).send("Invalid code");

    const promo = snap.val();

    if (promo.usesLeft === 0) {
      return res.status(400).send("Code expired");
    }

    const userRef = admin.database().ref(`users/${uid}`);
    const userSnap = await userRef.get();
    const balance = userSnap.val()?.balance || 0;

    await userRef.update({
      balance: balance + promo.amount,
    });

    await ref.update({
      usesLeft: (promo.usesLeft ?? 1) - 1,
      [`usedBy/${uid}`]: true,
    });

    res.json({ success: true, added: promo.amount });
  } catch (err) {
    console.error(err);
    res.status(500).send("Error");
  }
});

app.post("/update-profile", authenticate, async (req, res) => {
  try {
    const { username, robloxName, newPassword, oldUsername, oldPassword } =
      req.body;
    const uid = req.user.uid;

    if (!username || !robloxName || !newPassword) {
      return res.status(400).json({ error: "Missing fields" });
    }

    // 1. récupérer utilisateur actuel (sécurisé)
    const currentSnap = await db.ref(`users/${uid}`).get();
    if (!currentSnap.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUser = currentSnap.val();

    // 2. check ancien username appartient bien à ce user
    if (currentUser.username !== oldUsername) {
      return res.status(403).json({ error: "Username invalide" });
    }

    // 3. récupérer email via current user (PAS via search)
    const email = currentUser.email;

    // 4. vérifier password Firebase
    const response = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.FIREBASE_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password: oldPassword,
          returnSecureToken: false,
        }),
      },
    );

    if (!response.ok) {
      return res.status(401).json({ error: "identifiants incorrectes" });
    }

    // 1. récupérer user actuel
    const userRef = db.ref(`users/${uid}`);
    const userSnap = await userRef.get();

    if (!userSnap.exists()) {
      return res.status(404).json({ error: "User not found" });
    }

    // 2. check username si changé
    if (username !== currentUser.username) {
      const snapshot = await db
        .ref("users")
        .orderByChild("username")
        .equalTo(username)
        .get();

      if (snapshot.exists()) {
        return res
          .status(409)
          .json({ error: "Nom d'utilisateur déjà utilisé" });
      }
    }

    // 3. update DB
    await userRef.update({
      username,
      RobloxName: robloxName,
    });

    // 4. update auth password
    await admin.auth().updateUser(uid, {
      password: newPassword,
    });

    return res.json({
      success: true,
      Email: `${currentUser.firstUsername}@bloxrobux.local`,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- Lancement serveur ---
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`✅ Serveur en ligne sur le port ${PORT}`);
});
