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

    /* =====================================================
       3️⃣ ÉTAT LOCAL
    ===================================================== */
    let state = {
        balance: 0,
        transactions: []
    };

    let userRef = null; // référence DB dynamique

    /* =====================================================
       4️⃣ UTILITAIRES
    ===================================================== */
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

        // ❌ Non connecté
        if (!user) {
            state.balance = 0;
            state.transactions = [];
            render();
            if (withdrawBtn) withdrawBtn.disabled = true;
            return;
        }

        // ✅ Connecté
        const uid = user.uid;
        userRef = db.ref("users/" + uid);
        if (withdrawBtn) withdrawBtn.disabled = false;

        // 🔁 Écoute temps réel du user
        userRef.on("value", snapshot => {
            if (!snapshot.exists()) return;

            const data = snapshot.val();
            state.balance = data.balance || 0;
            state.transactions = data.transactions || [];
            render();
        });
    });

    /* =====================================================
       8️⃣ RETRAIT
    ===================================================== */
    function addTransaction(value) {
        const amount = Math.round(value * 100) / 100;

        if (amount <= 0) return showError("Montant invalide !");
        if (amount < 25) return showError("Minimum 25 !");
        if (amount > 375) return showError("Maximum 375 !");
        if (amount > state.balance) return showError("Solde insuffisant !");

        showTemplate();

        const taxe = Math.round(amount * 1.3);
        const taxelabel = document.getElementById("robuxadd");
        if (taxelabel) {
            taxelabel.innerHTML =
                `🛑 Vous indiquerez ${taxe} Robux dans l'encadré rouge de l'image !`;
        }
        //const tx = {
            //id: Date.now(),
            //type: "withdraw",
            //amount: -amount,
            //date: new Date().toISOString()
        //};

        //state.balance -= amount;
        //state.transactions.push(tx);

        //userRef.update({
            //balance: state.balance,
            //transactions: state.transactions
        //}).catch(err => console.error(err));

        //render(); // mise à jour immédiate
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
});
