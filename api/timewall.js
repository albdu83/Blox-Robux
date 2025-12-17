import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
    databaseURL: "https://bloxrobux-e9244-default-rtdb.europe-west1.firebasedatabase.app"
  });
}

const db = admin.database();
const transactionsRef = db.ref("transactions");

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

    // 🔒 Anti-doublon Firebase
    const txSnap = await transactionsRef.child(transactionID).get();
    if (txSnap.exists())
      return res.status(200).send("duplicate");

    const amount = Math.round(Number(currencyAmount));
    if (isNaN(amount) || amount <= 0)
      return res.status(400).send("Invalid amount");

    // Enregistre la transaction
    await transactionsRef.child(transactionID).set({
      userID,
      amount,
      type,
      date: Date.now()
    });

    // 🔥 Crédit Firebase (atomique)
    const balanceRef = db.ref("users/" + userID + "/balance");
    await balanceRef.transaction(current => (current || 0) + amount);

    console.log(`✅ Timewall → Firebase ${userID} +${amount}`);
    res.status(200).send("OK");

  } catch (err) {
    console.error("Timewall error:", err);
    res.status(500).send("Server error");
  }
});

