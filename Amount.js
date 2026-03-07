document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1️⃣ RÉCUPÉRATION FIREBASE
    ===================================================== */
    const db = window.db;
    const auth = window.auth;

    if (!db || !auth) {
        console.error("Firebase n'est pas initialisé !");
        return;
    }

    /* =====================================================
       2️⃣ ÉLÉMENTS DOM
    ===================================================== */
    const balanceEl = document.getElementById("balance");
    const balanceEl2 = document.getElementById("balance2");
    const amountEl = document.getElementById("amount");
    const withdrawBtn = document.getElementById("withdrawBtn");
    const transactionsEl = document.getElementById("transactions");
    const errorEl = document.getElementById("error");

    const template = document.getElementById("background");
    const finalStep = document.getElementById("finalStep");
    const finalStep2 = document.getElementById("finalStep2");
    const helpbutton = document.getElementById("HELP");
    const btnretour = document.getElementById("btnretour");
    const gainnotif = document.getElementById("gainnotif");
    const notifbackgroundwin = document.getElementById("notifbackgroundwin");
    const closenotif = document.getElementById("closenotif");
    const closenotif2 = document.getElementById("closenotif2");
    const sousnotifbackground = document.getElementById("sous-notifbackground")

    /* =====================================================
       3️⃣ ÉTAT LOCAL
    ===================================================== */
    let state = {
        balance: 0,
        transactions: []
    };
    let pendingNotifications = [];
    let userRef = null; // référence DB dynamique
    let userIsActive = true;

    /* =====================================================
       4️⃣ UTILITAIRES
    ===================================================== */
    document.addEventListener("visibilitychange", () => {
        userIsActive = !document.hidden;
        if (!document.hidden && pendingNotifications.length > 0) {
            pendingNotifications.forEach(n => showGainNotification(n.data, n.delta));
            pendingNotifications = [];
        }
    });

    function showGainNotification(data, delta) {
        gainnotif.innerText = `${delta > 0 ? 'Bravo ,' : 'Oh non... '}vous venez de ${delta > 0 ? 'gagner' : 'perdre'} ${Math.abs(delta)} R$ sur le site !`;
        notifbackgroundwin.style.display = "flex";
        // Forcer l'animation
        setTimeout(() => {
            notifbackgroundwin.classList.toggle("show"),
            sousnotifbackground.classList.toggle("show")
        }, 50);
    }

    function formatMoney(num) {
        const n = (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
        return n.replace('.', ',') + ' R$';
    }

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg;
        errorEl.style.display = "block";
        setTimeout(() => errorEl.style.display = "none", 3000);
    }

    /* =====================================================
       5️⃣ TEMPLATES UI (inchangés)
    ===================================================== */
    function showTemplate() {
        template.style.display = "flex";
        setTimeout(() => {
            template.classList.add("active");
            finalStep.classList.add("active");
        }, 0);
    }

    function HideTemplate() {
        setTimeout(() => finalStep.classList.add("active2"), 0);
    }

    function ShowTemplate2() {
        finalStep.style.display = "none";
        finalStep2.style.display = "flex";
        setTimeout(() => finalStep2.classList.add("active3"), 0);
    }

    function ShowTemplate3() {
        finalStep2.style.display = "none";
        finalStep.style.display = "flex";
        setTimeout(() => finalStep.classList.add("active4"), 0);
    }

    function HideTemplate2() {
        setTimeout(() => finalStep2.classList.add("active5"), 0);
    }

    /* =====================================================
       6️⃣ RENDER
    ===================================================== */
    function renderTransactions() {
        if (!transactionsEl) return;

        transactionsEl.innerHTML = "";

        if (!state.transactions || state.transactions.length === 0) {
            transactionsEl.innerHTML =
                '<p class="empty">Aucun retrait effectué.</p>';
            return;
        }

        const total = state.transactions.length;

        const divHeader = document.createElement("div");
        divHeader.className = "divHeader";
        divHeader.innerHTML = `
            <span>Retrait n° :</span>
            <span>Retrait ID :</span>
            <span>Retrait valeur :</span>
        `;
        transactionsEl.appendChild(divHeader);

        state.transactions
            .slice(-10)
            .reverse()
            .forEach((tx, index) => {
                const order = total - index;

                const div = document.createElement("div");
                div.className = "transaction";
                div.innerHTML = `
                    <span>${order} - Retrait</span>
                    <span class="copy-id" data-copy="${tx.id}">
                        ID : ${tx.id}
                        <img src="../img/copy (2).png" class="copy-img">
                    </span>
                    <span class="neg">${formatMoney(Math.abs(tx.amount))}</span>
                `;
                transactionsEl.appendChild(div);
            });
    }

    function render() {
        if (balanceEl && balanceEl2) {
            balanceEl.textContent = formatMoney(state.balance);
            balanceEl2.textContent = formatMoney(state.balance);
        }
        renderTransactions();
    }

    /* =====================================================
       7️⃣ 🔥 AUTH FIREBASE — CORRECTION PRINCIPALE
    ===================================================== */
    auth.onAuthStateChanged(user => {
        gainnotif.innerText = ""
        // ❌ Non connecté
        if (!user) {
            state.balance = 0;
            state.transactions = [];
            render();
            if (withdrawBtn) withdrawBtn.disabled = true;
            return;
        }

        // ✅ Connecté
        user.getIdToken().then(token => {
            const evtSource = new EventSource(`${API_BASE_URL}/api/sse/balance?token=${token}`);

            // Réception des données temps réel
            evtSource.onmessage = (event) => {
                const data = JSON.parse(event.data);

                // Mise à jour de l'état local
                const oldBalance = state.balance;
                state.balance = data.balance || 0;
                state.transactions = data.transactions || [];
                render();

                // Calcul du delta si le serveur ne l'envoie pas directement
                const delta = data.delta ?? (state.balance - oldBalance);

                // Notification de gain
                if (delta && delta !== 0) {
                    if (userIsActive) {
                        showGainNotification(data, delta);
                    } else {
                        pendingNotifications.push({ data, delta });
                    }
                }
            };

            // Gestion déconnexion SSE
            evtSource.onerror = () => {
                console.error("SSE disconnected");
            };
        });
    });

    /* =====================================================
       8️⃣ RETRAIT
    ===================================================== */
    async function addTransaction(amount) {
        try {
            const res = await fetch(`${API_BASE_URL}/api/withdraw`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, RobloxP })
            });
                const data = await res.json();

            if (data.error) return showError(data.error);

            // Mettre à jour le front avec la nouvelle balance
            state.balance = data.balance;
            //state.transactions.push(data.transaction);
            render();
        } catch (err) {
            console.error(err);
            showError("Erreur serveur, réessayez plus tard");
        }
    }

    if (withdrawBtn) {
        withdrawBtn.addEventListener("click", () => {
            if (!amountEl) return showError("Champ montant introuvable");
            const value = parseFloat(amountEl.value);
            if (isNaN(value)) return showError("Montant invalide");

            addTransaction(value);

            finalStep.classList.forEach(c => c.startsWith("active") && finalStep.classList.remove(c));
            finalStep2.classList.forEach(c => c.startsWith("active") && finalStep2.classList.remove(c));
        });
    }

    /* =====================================================
       9️⃣ NAVIGATION UI
    ===================================================== */
    if (helpbutton) {
        helpbutton.addEventListener("click", () => {
            HideTemplate();
            ShowTemplate2();
        });
    }

    if (btnretour) {
        btnretour.addEventListener("click", () => {
            HideTemplate2();
            ShowTemplate3();
        });
    }

    function closeNotif() {
        // 1️⃣ Lancer l’animation de sortie
        notifbackgroundwin.classList.remove("show");
        sousnotifbackground.classList.remove("show");

        // 2️⃣ Attendre la fin de la transition avant de masquer complètement
        setTimeout(() => {
            notifbackgroundwin.style.display = "none";
        }, 300); // doit correspondre à la durée de ta transition CSS
    }

    if (closenotif) closenotif.addEventListener("click", closeNotif);
    if (closenotif2) closenotif2.addEventListener("click", closeNotif);
});
