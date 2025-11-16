document.addEventListener("DOMContentLoaded", () => {

    const db = window.db; // récupère la db initialisée dans Data.js
if (!db) {
    console.error("Firebase Database n'est pas initialisée !");
    return;
}

    const balanceEl = document.getElementById("balance");
    const amountEl = document.getElementById("amount");
    const labelEl = document.getElementById("label");
    const withdrawBtn = document.getElementById("withdrawBtn");
    const transactionsEl = document.getElementById("transactions");
    const errorEl = document.getElementById("error");

    const connectedUser = localStorage.getItem("connectedUser");
    if (!connectedUser) {
        balanceEl.textContent = "0,00 R$";
        showError("Vous devez être connecté pour retirer des Robux !");
        withdrawBtn.disabled = true;
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

        state.transactions.slice().reverse().forEach(tx => {
            const div = document.createElement("div");
            div.className = "transaction";
            div.innerHTML = `
                <span>${tx.label || 'Retrait'}</span>
                <span class="neg">${formatMoney(Math.abs(tx.amount))}</span>
            `;
            transactionsEl.appendChild(div);
        });
    }

    function render() {
        balanceEl.textContent = formatMoney(state.balance);
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
    function addTransaction(value, label) {
        const amount = Math.round(value * 100) / 100;

        if (amount <= 0) return showError("Montant invalide !");
        if (amount > state.balance) return showError("Solde insuffisant !");

        const tx = {
            id: Date.now(),
            type: "withdraw",
            amount: -amount,
            label: label || "Retrait",
            date: new Date().toISOString()
        };

        state.balance -= amount;
        state.transactions.push(tx);

        userRef.set({
            balance: state.balance,
            transactions: state.transactions
        }).catch(err => console.error(err));
    }

    if (withdrawBtn) {
        withdrawBtn.addEventListener("click", () => {
        const value = parseFloat(amountEl.value);
        if (isNaN(value)) return showError("Montant invalide !");
        addTransaction(value, labelEl.value.trim());
        amountEl.value = "";
        labelEl.value = "";
    });
    }

});

