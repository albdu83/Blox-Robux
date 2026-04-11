document.addEventListener("DOMContentLoaded", async () => {

    const { auth, db } = await initFirebase();

    if (!db || !auth) {
        console.error("Firebase n'est pas initialisé !");
        return;
    }

    const gif = document.getElementById("loading")
    const saveBtn = document.getElementById("saveProfile");
    const warn = document.getElementById("warn");
    const confirmBtn = document.getElementById("Confirm");
    const msg = document.getElementById("profileMessage");
    const msg2 = document.getElementById("profileMessage2");
    const pseudoR = document.getElementById("pseudoR");

    function formatTime(seconds) {
        const min = Math.floor(seconds / 60);
        const sec = seconds % 60;
        return `${min} min ${sec.toString().padStart(2, "0")} s`;
    }

    let pendingData = null;

    firebase.auth().onAuthStateChanged(user => {
        if (!user) {
            console.log("Utilisateur non connecté");
            return;
        }

        const uid = user.uid;
        updateProfileInfo(uid);
    });
    const imgage = document.getElementById("roblox");
    async function setRobloxAvatar(robloxName) {
        pseudoR.innerHTML = `@${robloxName}`;
        try {
            const res = await fetch(`https://blox-robux.onrender.com/api/avatar/${robloxName}`);
            const data = await res.json();
            if (!imgage) return;

            imgage.src = data.avatarUrl || "img/default-avatar.png";
            imgage.style.display = "inline-block";

        } catch (err) {
            console.error("Erreur avatar :", err);
        }
    }

    async function updateProfileInfo(uid) {
        try {
            const snapshot = await db.ref(`users/${uid}`).get();
            if (!snapshot.exists()) return;
            const data = snapshot.val();
            setRobloxAvatar(data.RobloxName)
            document.getElementById("robuxGagnes").textContent = data.robuxGagnes ?? "0";
            document.getElementById("retraits").textContent = Object.keys(data.transactions || {}).length;
            document.getElementById("balance").textContent = data.balance ?? "0";
            document.getElementById("statut").textContent = data.role ?? "Utilisateur";
            document.getElementById("nomRoblox").textContent = data.RobloxName ?? "—";
            document.getElementById("Username").textContent = data.username ?? "—";
            const date = data.createdAt ? new Date(data.createdAt).toLocaleDateString() : "—";
            document.getElementById("motdepasse").textContent = date;
            document.getElementById("nbConnexions").textContent = data.nbConnexions ?? "0";

        } catch (err) {
            console.error("Erreur mise à jour profil :", err);
        }
    }

    /* =========================
       ENREGISTRER PROFIL
    ========================== */
    saveBtn.addEventListener("click", async () => {
        msg.textContent = "";

        const user = auth.currentUser;
        if (!user) return showMsg(msg, "❌ Utilisateur non connecté");

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value.trim();
        const confirmPassword = document.getElementById("email").value.trim();
        const robloxName = document.getElementById("Roblox").value.trim();

        if (!username || !password || !confirmPassword || !robloxName) 
            return showMsg(msg, "❌ Informations manquantes");
        if (password !== confirmPassword) 
            return showMsg(msg, "❌ Les mots de passe ne correspondent pas");
        if (password.length < 6) 
            return showMsg(msg, "❌ Mot de passe trop court");

        /* Vérif pseudo Roblox via backend */
        try {
            const res = await fetch(`${API_BASE_URL}/api/roblox-user/${robloxName}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ usernames: [robloxName], excludeBannedUsers: true })
            });
            const data = await res.json();
            if (!data?.data?.length) return showMsg(msg, "❌ Pseudo Roblox inexistant");
        } catch {
            return showMsg(msg, "❌ Erreur serveur Roblox");
        }

        /* On stocke l’action */
        pendingData = { username, password, robloxName };

        warn.style.display = "flex";
        requestAnimationFrame(() => {
            warn.classList.add("active");
        });
    });

    /* =========================
       CONFIRMATION (RÉAUTH)
    ========================== */
    confirmBtn.addEventListener("click", async () => {
        confirmBtn.style.display = "none";
        gif.style.display = "flex";
        const DURATION = 5 * 60; // 300s
        let time = 0;

        const endTime = localStorage.getItem("endTime");

        if (endTime) {
        time = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        }

        // ⛔ Si le timer est encore actif
        if (time > 0) {
            gif.style.display = "none"
            confirmBtn.style.display = "block"
            return showMsg(
                msg2,
                `❌ Réessayez dans ${formatTime(time)}`
            );
        }

        msg2.textContent = "";
        if (!pendingData) {
            gif.style.display = "none";
            confirmBtn.style.display = "block";
            return;
        }

        const user = auth.currentUser;
        const oldUsername = document.getElementById("a").value.trim();
        const oldPassword = document.getElementById("b").value.trim();
        if (!oldUsername || !oldPassword) {
            gif.style.display = "none";
            confirmBtn.style.display = "block";
            return showMsg(msg2, "❌ Informations manquantes");
        }

        /* --- Récupération de l'email via backend --- */
        let email;
        try {
            const token = await user.getIdToken();
            const emailRes = await fetch(`${API_BASE_URL}/getEmail?username=${encodeURIComponent(oldUsername)}`, {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!emailRes.ok) {
                gif.style.display = "none";
                confirmBtn.style.display = "block";
                return showMsg(msg2, "❌ nom d'utilisateur incorrect");
            }
            const json = await emailRes.json();
            email = json.email;
        } catch {
            gif.style.display = "none"
            confirmBtn.style.display = "block"
            return showMsg(msg2, "❌ Impossible de récupérer les données");
        }

        /* --- Réauthentification --- */
        try {
            const credential = firebase.auth.EmailAuthProvider.credential(email, oldPassword);
            await user.reauthenticateWithCredential(credential);
        } catch {
            gif.style.display = "none"
            confirmBtn.style.display = "block"
            return showMsg(msg2, "❌ Mot de passe incorrect");
        }

        /* --- Mise à jour du profil via Firebase --- */
        try {
            const uid = user.uid;

            /* On met à jour DB et Firebase Auth */
            const updates = {
                username: pendingData.username,
                RobloxName: pendingData.robloxName
            };
            await db.ref(`users/${uid}`).update(updates);
            await user.updatePassword(pendingData.password);


            warn.classList.remove("active");

            warn.addEventListener("transitionend", function handleEnd() {
                warn.style.display = "none";
                warn.removeEventListener("transitionend", handleEnd);
            });
            gif.style.display = "none"
            confirmBtn.style.display = "block"
            showMsg(msg, "✅ Profil mis à jour", true);

            const newEndTime = Date.now() + DURATION * 1000;
            localStorage.setItem("endTime", newEndTime);
            time = DURATION;

            // reset champs
            ["username","password","email","Roblox","a","b"].forEach(id => document.getElementById(id).value = "");
            pendingData = null;

            const timer = setInterval(() => {
                time--;

                if (time <= 0) {
                    clearInterval(timer);
                    console.log("Temps écoulé");
                }
            }, 1000);

        } catch (err) {
            gif.style.display = "none"
            confirmBtn.style.display = "block"
            console.error(err);
            showMsg(msg2, "❌ Erreur lors de la mise à jour");
        }
    });

    /* =========================
       Fonctions utilitaires
    ========================== */
    function showMsg(el, text, success=false) {
        el.textContent = text;
        el.style.color = success ? "#00ff6a" : "#ff5555";
        setTimeout(() => el.textContent = "", 3000);
    }
        /* ----- PROMOCODE ----- */
    document.getElementById("applyPromo").addEventListener("click", async () => {
        const inputEl = document.getElementById("promoInput");
        const codeInput = inputEl.value.trim().toUpperCase();
        const msg = document.getElementById("promoMessage");
        const user = firebase.auth().currentUser;
        if (!codeInput || /[.#$\[\]]/.test(codeInput)) {
            inputEl.value = ""
            return showMsg(msg, "❌ Code promo invalide.");
        }
        if (!user) return showMsg(msg, "❌ Vous devez être connecté");

        try {
            const snapshot = await db.ref(`promocodes/${codeInput}`).get();
            if (!snapshot.exists() || codeInput === "") {
                inputEl.value = "";
                return showMsg(msg, "❌ Code invalide."); 
            }

            const promo = snapshot.val();
            const now = new Date();

            // Vérifier expiration
            if (promo.expiration && new Date(promo.expiration) < now) {
                inputEl.value = ""
                return showMsg(msg, "❌ Ce code a expiré.");
            }

            // Vérifier si utilisateur a déjà utilisé
            if (promo.usedBy && promo.usedBy[user.uid]) {
                inputEl.value = ""
                return showMsg(msg, "❌ Vous avez déjà utilisé ce code.");
            }

            // Vérifier si le code a encore des utilisations
            if (promo.usesLeft !== undefined && promo.usesLeft <= 0) {
                inputEl.value = ""
                return showMsg(msg, "❌ Ce code n'est plus disponible.");
            }

            // Ajouter le Robux à l'utilisateur
            const userRef = db.ref(`users/${user.uid}`);
            const userSnap = await userRef.get();
            const balance = userSnap.val()?.balance || 0;
            await userRef.update({ balance: balance + promo.amount });

            // Mettre à jour le code promo (usedBy + decrement usesLeft)
            const updates = {};
            updates[`promocodes/${codeInput}/usedBy/${user.uid}`] = true;
            if (promo.usesLeft !== undefined) updates[`promocodes/${codeInput}/usesLeft`] = promo.usesLeft - 1;

            await db.ref().update(updates);
            inputEl.value = ""
            showMsg(msg, `✔️ +${promo.amount} R$ ajouté !`, true);
        } catch (err) {
            console.error(err);
            inputEl.value = ""
            showMsg(msg, "❌ Une erreur est survenue.");
        }
    });

    const header = document.querySelector("header");
        
    window.addEventListener("scroll", () => {
        if (window.scrollY > 50) {
            header.classList.add("scrolled");
        } else {
            header.classList.remove("scrolled");
        }
    });
});
