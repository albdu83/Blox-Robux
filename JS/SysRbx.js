/*
 * Retraits.js
 * Script unique pour la page Retraits.
 * Dépendances laissées volontairement partagées : Server.js (API_BASE_URL,
 * initFirebase, ID) et les scripts Firebase chargés dans Retraits.html.
 */

document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();
  if (!auth || !db) {
    console.error("Firebase n'est pas initialisé.");
    return;
  }

  const ui = {
    balance: document.getElementById("balance"),
    balanceMobile: document.getElementById("balance2"),
    amount: document.getElementById("amount"),
    startButton: document.getElementById("withdrawBtn"),
    confirmButton: document.getElementById("buttonretrait"),
    placeSelect: document.getElementById("public-places"),
    transactions: document.getElementById("transactions"),
    error: document.getElementById("error"),
    stock: document.getElementById("remainingStock"),
    stockIcon: document.querySelector(".stock-icon"),
    stockCard: document.querySelector(".stock-card"),
    overlay: document.getElementById("background"),
    withdrawalStep: document.getElementById("finalStep"),
    helpStep: document.getElementById("finalStep2"),
    tutorial: document.getElementById("tutocontainer"),
    explanation: document.getElementById("explain"),
    noGameButton: document.getElementById("HELP"),
    helpButton: document.getElementById("buttonhelp"),
    helpBackButton: document.getElementById("btnretour"),
    closeHelpButton: document.getElementById("closeHelpBtn"),
    helpFrame: document.getElementById("help-frame"),
    helpSelect: document.getElementById("HelpType"),
    priceHint: document.getElementById("robuxadd"),
    accessLink: document.getElementById("href"),
    questionnaireLink: document.getElementById("href2"),
    progressFrame: document.getElementById("hacker-frame"),
    progressText: document.getElementById("hacker-text"),
    summaryFrame: document.getElementById("summary-frame"),
  };

  const state = {
    balance: 0,
    transactions: [],
    amount: null,
    selectedPlaceId: null,
    targetId: null,
    rootIdByPlaceId: new Map(),
    eventSource: null,
    isSubmitting: false,
    tutorialWasOpened: false,
  };

  function money(value) {
    return `${Number(value || 0).toFixed(2).replace(".", ",")} R$`;
  }

  function showError(message) {
    if (!ui.error) return;
    ui.error.textContent = message;
    ui.error.style.display = "block";
    window.clearTimeout(showError.timeout);
    showError.timeout = window.setTimeout(() => {
      ui.error.style.display = "none";
    }, 4000);
  }

  function setButtonLoading(button, loading) {
    if (!button) return;
    button.disabled = loading;
    button.setAttribute("aria-busy", String(loading));
  }

  function setStepVisibility(element, visible) {
    if (!element) return;
    element.style.display = visible ? "flex" : "none";
    element.classList.toggle("show", visible);
  }

  function openWithdrawalStep() {
    if (!ui.overlay || !ui.withdrawalStep) return;
    setStepVisibility(ui.helpStep, false);
    ui.overlay.style.display = "flex";
    ui.overlay.classList.add("active");
    setStepVisibility(ui.withdrawalStep, true);
  }

  function closeWithdrawalStep() {
    setStepVisibility(ui.withdrawalStep, false);
    if (ui.overlay) {
      ui.overlay.classList.remove("active");
      ui.overlay.style.display = "none";
    }
  }

  function openHelp() {
    setStepVisibility(ui.withdrawalStep, false);
    setStepVisibility(ui.helpStep, true);
  }

  function closeHelp() {
    setStepVisibility(ui.helpStep, false);
    setStepVisibility(ui.withdrawalStep, true);
  }

  function renderBalance() {
    [ui.balance, ui.balanceMobile].filter(Boolean).forEach((element) => {
      element.textContent = money(state.balance);
    });
  }

  function renderStock(stockValue) {
    const stock = Number(stockValue || 0);
    if (ui.stock) ui.stock.textContent = stock.toLocaleString("fr-FR");
    if (!ui.stockCard || !ui.stockIcon || !ui.stock) return;

    const color = stock <= 15 ? "#da1414" : stock <= 100 ? "#FFC107" : "#28d42e";
    const background = stock <= 15 ? "#a51e1e11" : stock <= 100 ? "#ffc1071a" : "#4caf4f1c";
    const border = stock <= 15 ? "#961d1d48" : stock <= 100 ? "#ffc1072f" : "#4caf4f54";
    ui.stock.style.color = color;
    ui.stockIcon.style.background = color;
    ui.stockCard.style.background = background;
    ui.stockCard.style.borderColor = border;
  }

  function renderTransactions() {
    if (!ui.transactions) return;
    ui.transactions.replaceChildren();

    if (!state.transactions.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = "Aucun retrait effectué.";
      ui.transactions.append(empty);
      return;
    }

    const header = document.createElement("div");
    header.className = "divHeader";
    ["Retrait n°", "Référence", "Montant"].forEach((label) => {
      const item = document.createElement("span");
      item.textContent = label;
      header.append(item);
    });
    ui.transactions.append(header);

    state.transactions.slice(-10).reverse().forEach((transaction, index) => {
      const row = document.createElement("div");
      row.className = "transaction";
      const number = document.createElement("span");
      number.textContent = `${state.transactions.length - index} - Retrait`;
      const reference = document.createElement("button");
      reference.type = "button";
      reference.className = "copy-id";
      reference.textContent = `ID : ${transaction.id || "indisponible"}`;
      reference.addEventListener("click", async () => {
        if (!transaction.id || !navigator.clipboard) return;
        await navigator.clipboard.writeText(String(transaction.id));
        reference.textContent = "ID copié";
        setTimeout(() => (reference.textContent = `ID : ${transaction.id}`), 1200);
      });
      const amount = document.createElement("span");
      amount.className = "neg";
      amount.textContent = money(Math.abs(Number(transaction.amount || 0)));
      row.append(number, reference, amount);
      ui.transactions.append(row);
    });
  }

  function showProgress(message, currentStep = 1) {
    if (!ui.progressFrame) return;
    if (!ui.progressFrame.querySelector(".withdrawal-progress")) {
      const card = document.createElement("section");
      card.className = "withdrawal-progress";
      card.setAttribute("role", "status");
      card.setAttribute("aria-live", "polite");

      const spinner = document.createElement("div");
      spinner.className = "withdrawal-progress__spinner";
      spinner.setAttribute("aria-hidden", "true");
      const title = document.createElement("h2");
      title.textContent = "Traitement de votre retrait";
      const description = document.createElement("p");
      description.className = "withdrawal-progress__message";
      const steps = document.createElement("ol");
      steps.className = "withdrawal-progress__steps";
      ["Vérification", "Création du retrait", "Confirmation"].forEach((label, index) => {
        const item = document.createElement("li");
        item.dataset.step = String(index + 1);
        item.textContent = label;
        steps.append(item);
      });
      card.append(spinner, title, description, steps);
      ui.progressFrame.replaceChildren(card);
    }

    ui.progressFrame.querySelector(".withdrawal-progress__message").textContent = message;
    ui.progressFrame.querySelectorAll("[data-step]").forEach((step) => {
      const position = Number(step.dataset.step);
      step.classList.toggle("is-current", position === currentStep);
      step.classList.toggle("is-complete", position < currentStep);
    });
    ui.progressFrame.style.display = "block";
    requestAnimationFrame(() => ui.progressFrame.classList.add("visible"));
  }

  function hideProgress() {
    ui.progressFrame?.classList.remove("visible");
    setTimeout(() => {
      if (ui.progressFrame) ui.progressFrame.style.display = "none";
    }, 250);
  }

  function showSummary({ success, title, message, amount }) {
    if (!ui.summaryFrame) return;
    ui.summaryFrame.replaceChildren();
    ui.summaryFrame.className = `summary-frame ${success ? "summary-success" : "summary-error"}`;

    const top = document.createElement("div");
    top.className = "summary-top";
    const heading = document.createElement("div");
    heading.className = "summary-title";
    heading.textContent = title;
    const status = document.createElement("span");
    status.className = "summary-status";
    status.textContent = success ? "CONFIRMÉ" : "À RÉESSAYER";
    top.append(heading, status);
    const text = document.createElement("p");
    text.className = "summary-message";
    text.textContent = message;
    const details = document.createElement("p");
    details.className = "summary-value";
    details.textContent = amount ? `Montant : ${money(amount)}` : "";
    const close = document.createElement("button");
    close.type = "button";
    close.className = `summary-btn ${success ? "success-btn" : "error-btn"}`;
    close.textContent = success ? "Fermer" : "Retour";
    close.addEventListener("click", () => {
      ui.summaryFrame.classList.remove("visible");
      setTimeout(() => {
        ui.summaryFrame.style.display = "none";
        if (!success) openWithdrawalStep();
        else closeWithdrawalStep();
      }, 250);
    });
    ui.summaryFrame.append(top, text, details, close);
    ui.summaryFrame.style.display = "block";
    requestAnimationFrame(() => ui.summaryFrame.classList.add("visible"));
  }

  async function loadPlaces(user) {
    if (!ui.placeSelect) return;
    ui.placeSelect.replaceChildren(new Option("Chargement des jeux…", ""));
    ui.placeSelect.disabled = true;
    state.rootIdByPlaceId.clear();

    try {
      const token = await user.getIdToken();
      if (!state.targetId) {
        const nameSnapshot = await db.ref(`users/${user.uid}/RobloxName`).get();
        const robloxName = nameSnapshot.val();
        if (!robloxName) throw new Error("Votre pseudo Roblox est introuvable.");
        const avatarResponse = await fetch(`${API_BASE_URL}/api/avatar/${encodeURIComponent(robloxName)}`);
        const avatarData = await avatarResponse.json().catch(() => ({}));
        if (!avatarResponse.ok || !avatarData.targetId) {
          throw new Error("Impossible de récupérer votre compte Roblox.");
        }
        state.targetId = String(avatarData.targetId);
      }
      const response = await fetch(`${API_BASE_URL}/api/places?targetId=${encodeURIComponent(state.targetId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Impossible de récupérer les jeux.");
      const payload = await response.json();
      const places = payload?.data || [];

      ui.placeSelect.replaceChildren(new Option("Sélectionner un jeu", "", true, true));
      ui.placeSelect.options[0].disabled = true;
      if (!places.length) {
        const option = new Option("Aucun emplacement public trouvé", "");
        option.disabled = true;
        ui.placeSelect.append(option);
        return;
      }

      places.forEach((place) => {
        state.rootIdByPlaceId.set(String(place.ID), place.RootID);
        ui.placeSelect.append(new Option(place.name || "Jeu sans nom", String(place.ID)));
      });
    } catch (error) {
      ui.placeSelect.replaceChildren(new Option("Impossible de charger les jeux", ""));
      ui.placeSelect.options[0].disabled = true;
      showError("Impossible de charger vos jeux Roblox. Réessayez plus tard.");
    } finally {
      ui.placeSelect.disabled = false;
    }
  }

  function prepareTutorial(placeId) {
    state.selectedPlaceId = placeId;
    if (ui.accessLink) ui.accessLink.href = `https://create.roblox.com/dashboard/creations/experiences/${placeId}/access`;
    if (ui.questionnaireLink) ui.questionnaireLink.href = `https://create.roblox.com/dashboard/creations/experiences/${placeId}/experience-questionnaire`;
    if (state.tutorialWasOpened) {
      ui.tutorial?.classList.add("active10");
      return;
    }

    state.tutorialWasOpened = true;
    ui.withdrawalStep?.classList.add("active9");
    ui.explanation?.classList.add("active6");
    ui.noGameButton?.classList.add("active7");
    const revealTutorial = () => {
      ui.tutorial?.classList.add("active10");
      ui.noGameButton?.classList.add("activeA");
      ui.explanation?.classList.add("activeB");
    };
    if (ui.explanation) {
      ui.explanation.addEventListener("transitionend", revealTutorial, { once: true });
      setTimeout(revealTutorial, 350);
    } else {
      revealTutorial();
    }
  }

  async function validateAmount() {
    const amount = Number(ui.amount?.value);
    if (!Number.isFinite(amount) || amount <= 0) {
      showError("Indiquez un montant de retrait valide.");
      return false;
    }
    const user = auth.currentUser;
    if (!user) {
      showError("Vous devez être connecté pour effectuer un retrait.");
      return false;
    }

    setButtonLoading(ui.startButton, true);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`${API_BASE_URL}/api/getBalance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ Montant: amount }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Votre solde ne permet pas ce retrait.");
      state.amount = amount;
      if (ui.priceHint) {
        const gamePassPrice = Math.round(amount / 0.7);
        ui.priceHint.textContent = `Vous indiquerez ${gamePassPrice} Robux dans l'encadré rouge.`;
      }
      openWithdrawalStep();
      await loadPlaces(user);
      return true;
    } catch (error) {
      showError(error.message || "Impossible de vérifier le montant.");
      return false;
    } finally {
      setButtonLoading(ui.startButton, false);
    }
  }

  async function waitForJob(token, jobId) {
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 3000));
      const response = await fetch(`${API_BASE_URL}/api/jobStatus`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ job_id: jobId }),
      });
      const data = await response.json().catch(() => ({}));
      if (data.status === "success") return data;
      if (data.status === "error") throw new Error(data.error || "Le retrait n'a pas pu être effectué.");
    }
    throw new Error("Le traitement prend plus de temps que prévu. Vérifiez votre historique avant de réessayer.");
  }

  async function submitWithdrawal() {
    if (state.isSubmitting) return;
    const rootId = state.rootIdByPlaceId.get(String(state.selectedPlaceId));
    if (!state.amount || !state.selectedPlaceId || !rootId) {
      showError("Choisissez un jeu avant de confirmer le retrait.");
      return;
    }
    const user = auth.currentUser;
    if (!user) return showError("Votre session a expiré. Reconnectez-vous.");

    state.isSubmitting = true;
    setButtonLoading(ui.confirmButton, true);
    setStepVisibility(ui.withdrawalStep, false);
    showProgress("Vérification de votre retrait…", 1);

    try {
      const token = await user.getIdToken();
      const balanceResponse = await fetch(`${API_BASE_URL}/api/getBalance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ Montant: state.amount }),
      });
      const balanceData = await balanceResponse.json().catch(() => ({}));
      if (!balanceResponse.ok) throw new Error(balanceData.error || "Votre solde ne permet plus ce retrait.");

      showProgress("Création de votre retrait…", 2);
      const paymentResponse = await fetch(`${API_BASE_URL}/api/payServer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ ID: state.targetId, gameId: rootId, amount: state.amount }),
      });
      const paymentData = await paymentResponse.json().catch(() => ({}));
      if (!paymentResponse.ok || !paymentData.success) {
        throw new Error(paymentData.error || "Le retrait n'a pas pu être lancé.");
      }

      showProgress("Finalisation de votre retrait…", 3);
      await waitForJob(token, paymentData.job_id);
      hideProgress();
      showSummary({
        success: true,
        title: "Retrait confirmé",
        message: "Votre serveur privé a été créé avec succès.",
        amount: state.amount,
      });
    } catch (error) {
      hideProgress();
      showSummary({
        success: false,
        title: "Retrait non effectué",
        message: error.message || "Une erreur est survenue. Aucun montant ne doit être débité si le retrait a échoué.",
        amount: state.amount,
      });
    } finally {
      state.isSubmitting = false;
      setButtonLoading(ui.confirmButton, false);
    }
  }

  function startBalanceStream(user) {
    state.eventSource?.close();
    (async () => {
      try {
        const token = await user.getIdToken(true);
        await fetch(`${API_BASE_URL}/setSseCookie`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: token }),
        });
        state.eventSource = new EventSource(`${API_BASE_URL}/api/sse/balance`, { withCredentials: true });
        state.eventSource.onmessage = ({ data }) => {
          const payload = JSON.parse(data);
          state.balance = Number(payload.balance || 0);
          state.transactions = Array.isArray(payload.transactions) ? payload.transactions : [];
          renderBalance();
          renderTransactions();
          renderStock(payload.stock_data?.remaining_solde);
        };
      } catch (error) {
        console.error("Impossible de démarrer les mises à jour du retrait.", error);
      }
    })();
  }

  ui.startButton?.addEventListener("click", validateAmount);
  ui.placeSelect?.addEventListener("change", (event) => prepareTutorial(event.target.value));
  ui.confirmButton?.addEventListener("click", submitWithdrawal);
  ui.noGameButton?.addEventListener("click", openHelp);
  ui.helpButton?.addEventListener("click", () => {
    if (!ui.helpFrame) return;
    ui.helpFrame.style.display = "block";
    requestAnimationFrame(() => ui.helpFrame.classList.add("visible"));
  });
  ui.closeHelpButton?.addEventListener("click", () => {
    ui.helpFrame?.classList.remove("visible");
    setTimeout(() => { if (ui.helpFrame) ui.helpFrame.style.display = "none"; }, 250);
  });
  ui.helpBackButton?.addEventListener("click", closeHelp);
  ui.helpSelect?.addEventListener("change", (event) => {
    document.querySelectorAll(".help-section").forEach((section) => {
      section.classList.toggle("active", section.id === event.target.value);
    });
  });
  auth.onAuthStateChanged((user) => {
    if (!user) {
      state.eventSource?.close();
      state.balance = 0;
      state.transactions = [];
      renderBalance();
      renderTransactions();
      setButtonLoading(ui.startButton, true);
      return;
    }
    setButtonLoading(ui.startButton, false);
    startBalanceStream(user);
  });
});
