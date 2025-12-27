document.addEventListener("DOMContentLoaded", () => {

    const db = window.db; // récupère la db initialisée dans Data.js
    if (!db) {
        console.error("Firebase Database n'est pas initialisée !");
        return;
    }

    const balanceEl = document.getElementById("balance");
    const amountEl = document.getElementById("amount");
    const withdrawBtn = document.getElementById("withdrawBtn");
    const transactionsEl = document.getElementById("transactions");
    const errorEl = document.getElementById("error");
    const template = document.getElementById("background")
    const connectedUser = localStorage.getItem("connectedUser");
    const finalStep = document.getElementById("finalStep")
    const finalStep2 = document.getElementById("finalStep2")
    const helpbutton = document.getElementById("HELP")
    const btnretour = document.getElementById("btnretour")
    if (!connectedUser) {
        if (balanceEl) balanceEl.textContent = "0.00 R$";
        showError("Vous devez être connecté pour retirer des Robux !");
        if (withdrawBtn) withdrawBtn.disabled = true;
        return;
    }

    const userRef = db.ref('users/' + connectedUser);

    // Etat local pour l'affichage
    let state = { balance: 0, transactions: [] };

    // ==================== UTILITAIRES ====================
    function formatMoney(num) {
        const n = (Math.round((num + Number.EPSILON) * 100) / 100).toFixed(2);
        return n.replace('.', ',') + ' R$';
    }

    function showTemplate() {
        template.style.display = "flex"
        setTimeout(() => {
            template.classList.add("active")
            finalStep.classList.add("active")
        }, 0);
    }

    function HideTemplate() {
        setTimeout(() => {
            finalStep.classList.add("active2")
        }, 0);
    }

    function ShowTemplate2() {
        finalStep.style.display = "none"
        finalStep2.style.display = "flex"
        setTimeout(() => {
            finalStep2.classList.add("active3")
        }, 0);
    }

    function ShowTemplate3() {
        finalStep2.style.display = "none"
        finalStep.style.display = "flex"
        setTimeout(() => {
            finalStep.classList.add("active4")
        }, 0);
    }

    function HideTemplate2() {
        setTimeout(() => {
            finalStep2.classList.add("active5")
        }, 0);
    }

    function showError(msg) {
        if (!errorEl) return;
        errorEl.textContent = msg;
        errorEl.style.display = "block";
        setTimeout(() => errorEl.style.display = "none", 3000);
    }

    function renderTransactions() {
        if (!transactionsEl) return;
        transactionsEl.innerHTML = "";
        if (!state.transactions || state.transactions.length === 0) {
            transactionsEl.innerHTML = '<p class="empty">Aucun retrait effectué.</p>';
            return;
        }

        const total = state.transactions.length;

            // Création du header
        const divHeader = document.createElement("div");
        divHeader.className = "divHeader";
        divHeader.innerHTML = `
            <span>Retrait n° :</span>
            <span>Retrait ID :</span>
            <span>Retrait valeur :</span>
        `;
        transactionsEl.appendChild(divHeader);

        // Prendre les 10 dernières transactions et les inverser
        const transactionsToShow = state.transactions.slice(-10).reverse();

        transactionsToShow.forEach((tx, index) => {
            const order = total - index; // Numéro d'ordre global

            const div = document.createElement("div");
            div.className = "transaction";
            div.innerHTML = `
                <span>${order} - Retrait</span>
                <span class="copy-id" data-copy="${tx.id}">ID : ${tx.id}
                    <img 
                        src="../img/copy (2).png"
                        class="copy-img"
                        id="copyimg"
                        data-copy="${tx.id}"
                    >
                </span>
                <span class="neg">${formatMoney(Math.abs(tx.amount))}</span>
            `;
            transactionsEl.appendChild(div);
        });
    }

    function render() {
        if (balanceEl) balanceEl.textContent = formatMoney(state.balance);
        renderTransactions();
    }

    // ==================== ECOUTE FIREBASE ====================
    userRef.on('value', snapshot => {
        const data = snapshot.val() || { balance: 0, transactions: [] };
        state.balance = data.balance || 0;
        state.transactions = data.transactions || [];
        render();
    });

    // ==================== RETRAIT ====================
    function addTransaction(value) {
        const amount = Math.round(value * 100) / 100;

        if (amount <= 0) return showError("Montant invalide !");
        if (amount < 25) return showError("le montant doit être supérieur à 25!");
        if (amount > 375) return showError("le montant doit être inférieur à 375!");
        if (amount > state.balance) return showError("Solde insuffisant !");
        showTemplate()
        const taxe = Math.round(amount * 1.3)
        const taxelabel = document.getElementById("robuxadd")
        taxelabel.innerHTML = `🛑 Vous indiquerez ${taxe} Robux dans l'encadré rouge de l'image!`
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
            if (!amountEl) return showError("Champ montant introuvable !");
            const value = parseFloat(amountEl.value);
            if (isNaN(value)) return showError("Montant invalide !");
            addTransaction(value);
            finalStep.classList.forEach(cls => {
                if (cls.startsWith("active")) finalStep.classList.remove(cls);
            });
            finalStep2.classList.forEach(cls => {
                if (cls.startsWith("active")) finalStep2.classList.remove(cls);
            });
        });
    }

    if (helpbutton) {
        helpbutton.addEventListener("click", () => {
            finalStep.classList.forEach(cls => {
                if (cls.startsWith("active")) finalStep.classList.remove(cls);
            });
            finalStep2.classList.forEach(cls => {
                if (cls.startsWith("active")) finalStep2.classList.remove(cls);
            });
            HideTemplate()
            ShowTemplate2()
        });
    }

    if (btnretour) {
        btnretour.addEventListener("click", () => {
            finalStep.classList.forEach(cls => {
                if (cls.startsWith("active")) finalStep.classList.remove(cls);
            });
            finalStep2.classList.forEach(cls => {
                if (cls.startsWith("active")) finalStep2.classList.remove(cls);
            });
            HideTemplate2()
            ShowTemplate3()
        });
    }
});
