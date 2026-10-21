document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();
  if (!auth || !db) return console.error("Firebase non initialisé");

  const API =
    typeof API_BASE_URL === "string" ? API_BASE_URL : window.API_BASE_URL || "";
  const configs = [
    { id: "blood", button: "openButton", threshold: 10 },
    { id: "vampire", button: "openButton2", threshold: 25 },
    { id: "haunted", button: "openButton3", threshold: 50 },
    { id: "pumpkin", button: "openButton4", threshold: 100 },
  ];
  const trickButton = document.getElementById("trickButton");
  const notice = document.createElement("p");
  notice.className = "halloween-notice";
  notice.setAttribute("role", "status");
  document.getElementById("trick-or-treat")?.append(notice);

  const buttons = configs.map((item) => ({
    ...item,
    element: document.getElementById(item.button),
  }));
  let eventActive = false;

  async function api(path, options = {}) {
    const user = auth?.currentUser;
    if (!user) throw new Error("Connecte-toi pour participer à l’événement.");
    const token = await user.getIdToken();
    const response = await fetch(API + path, {
      ...options,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || "Erreur serveur.");
    return data;
  }

  function showMessage(message, isError = false) {
    notice.textContent = message;
    notice.classList.toggle("is-error", isError);
  }

  function render(data) {
    const earned = Number(data.earnedToday || 0);
    buttons.forEach((item) => {
      if (!item.element) return;
      const claim = data.chests?.[item.id];
      item.element.disabled = Boolean(claim) || earned < item.threshold;
      item.element.classList.toggle("locked", item.element.disabled);
      item.element.textContent = claim
        ? `Déjà ouvert${claim.reward > 0 ? ` · +${claim.reward} R$` : " · perdu !"}`
        : earned < item.threshold
          ? `Gagner ${item.threshold} R$ (${earned}/${item.threshold})`
          : "Ouvrir le coffre";
    });

    if (trickButton) {
      trickButton.disabled = Boolean(data.trickOrTreat);
      trickButton.textContent = data.trickOrTreat
        ? "Déjà tenté aujourd’hui"
        : "Tenter ma chance";
    }
  }

  async function load() {
    try {
      const statusResponse = await fetch(API + "/api/halloween/status", {
        cache: "no-store",
      });
      const status = await statusResponse.json();
      eventActive = Boolean(status.active);
      if (!eventActive) {
        buttons.forEach((item) => {
          if (item.element) item.element.disabled = true;
        });
        if (trickButton) trickButton.disabled = true;
        showMessage(
          status.ended
            ? "L’événement est terminé."
            : "Les jeux ouvriront à 18 h (heure de Paris).",
          false,
        );
        return;
      }
      const data = await api("/api/halloween/me");
      render(data);
    } catch (error) {
      showMessage(error.message, true);
    }
  }

  buttons.forEach((item) => {
    item.element?.addEventListener("click", async () => {
      item.element.disabled = true;
      try {
        const result = await api("/api/halloween/chest", {
          method: "POST",
          body: JSON.stringify({ chestId: item.id }),
        });
        showMessage(
          result.reward > 0
            ? `🎃 ${result.message} +${result.reward} R$ ont été ajoutés !`
            : `👻 ${result.message}`,
        );
        render(result);
      } catch (error) {
        showMessage(error.message, true);
        await load();
      }
    });
  });

  trickButton?.addEventListener("click", async () => {
    trickButton.disabled = true;
    try {
      const result = await api("/api/halloween/trick-or-treat", {
        method: "POST",
      });
      showMessage(
        result.reward > 0
          ? `🍬 Tu as gagné ${result.reward} R$ !`
          : "👻 Un sort ! Pas de récompense aujourd’hui.",
      );
      render(result);
    } catch (error) {
      showMessage(error.message, true);
      await load();
    }
  });

  if (auth) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        load();
        const refresh = window.setInterval(() => {
          if (!eventActive) load();
          else window.clearInterval(refresh);
        }, 15000);
      } else {
        buttons.forEach((item) => {
          if (item.element) item.element.disabled = true;
        });
        if (trickButton) trickButton.disabled = true;
        showMessage("Connecte-toi pour participer à l’événement.");
      }
    });
  } else {
    showMessage("Firebase Auth n’est pas initialisé sur cette page.", true);
  }
});
