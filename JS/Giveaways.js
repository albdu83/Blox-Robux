document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();
  if (!auth || !db) return console.error("Firebase non initialisé");

  const GiveawaysContainer = document.getElementById("giveaway");
  const lastGiveawayContainer = document.getElementById("last-giveaway");

  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      console.log("Utilisateur non connecté");
      return;
    }

    const Giveaways = await fetch(API_BASE_URL + "/api/giveaway", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${await user.getIdToken()}`,
        "Content-Type": "application/json",
      },
    });

    if (!Giveaways) {
      console.error(
        "Erreur lors de la récupération des giveaways :",
        Giveaways.message,
      );
      return;
    }

    const data = await Giveaways.json();

    lastGiveawayContainer.innerHTML = `        
      <h2>🎁 Dernier Giveaway :</h2>
        <div id="header_prizes" style="margin-bottom: 10px;">À gagner</div>
        <div class="card prize" style="display: flex; flex-direction: row; align-items: center; gap: 10px;">
          <div class="prize-icon">💰</div>
          <div>
            <strong class="prize-name">${data.lastGiveaway.prize}</strong>
            <p class="prize-desc">
              ${data.lastGiveaway.robux} R$ ont été mis en jeu !
            </p>
          </div>
        </div>
        <div id="header_winners" style="margin: 10px 0; font-weight: bold; font-size: 1.2em;">Gagnant(s)</div>
        <div class="card" style="display: flex; flex-direction: column; gap: 5px;">
          ${
            data.lastGiveaway.WinnersUsernames.length > 0
              ? data.lastGiveaway.WinnersUsernames.map(
                  (username) =>
                    `<div style="font-weight: bold; font-size: 1.3em;">${username}</div>`,
                ).join("")
              : "<p>Aucun gagnant pour ce giveaway.</p>"
          }
          <div style="font-size: 0.8em;">Nombre de participants : ${Object.keys(data.lastGiveaway.participants || {}).length}</div>
        </div>
      `;

    if (data.Empty) {
      GiveawaysContainer.innerHTML = `
      <h2 style="text-align: center; padding: 225px 0 0 0;">Aucun giveaway en cours...😭</h2>
      <p style="text-align: center; padding: 0 0 225px 0;">Reviens plus tard pour voir les prochains giveaways</p>
      `;
      return;
    }


    let eligible = data.eligible;

    if (data.giveaway.condition === "R$" && !data.giveaway.userParticipated) {
      eligible = false;
    }

    GiveawaysContainer.innerHTML = `        <h2>🎁 Participer au Giveaway !</h2>
        <div id="header_prizes">À gagner</div>
        <div class="card prize">
          <div class="prize-icon">💰</div>
          <div>
            <strong class="prize-name">${data.giveaway.prize}</strong>
            <p class="prize-desc">
              Gagnez ${data.giveaway.robux} R$ en participant !
            </p>
          </div>
        </div>
        <div id="header_conditions">Conditions</div>
        <div class="card">
          <div id="conditions"></div>
        </div>
        <div class="eligible-indicator ${eligible ? 'eligible' : 'not-eligible'}">
          Condition remplie: ${eligible ? "✅" : "❌"}
        </div>
        <p>
          En participant au giveaway, vous affirmez avoir lu les conditions et
          vous engager à les remplir. Si celles-ci ne sont pas respectées, votre
          participation sera annulée.
        </p>
        <div class="btn" id="participate-btn" style="cursor: pointer;">Je participe</div>`;

    if (data.giveaway.userParticipated) {
      const participateBtn = document.getElementById("participate-btn");
      participateBtn.textContent = "Vous participez déjà au Giveaway !";
      participateBtn.disabled = true;
    }

    const timer = document.getElementById("timer-value");

    function updateTimer() {
      const remaining = new Date(data.giveaway.endDate).getTime() - Date.now();

      if (remaining <= 0) {
        timer.textContent = "Terminé";
        clearInterval(interval);
        return;
      }

      const seconds = Math.floor(remaining / 1000) % 60;
      const minutes = Math.floor(remaining / 60000) % 60;
      const hours = Math.floor(remaining / 3600000) % 24;
      const days = Math.floor(remaining / 86400000);

      if (minutes === 0) {
        timer.textContent = `${seconds}s`;
      } else if (hours === 0) {
        timer.textContent = `${minutes}m ${seconds}s`;
      } else if (days === 0) {
        timer.textContent = `${hours}h ${minutes}m ${seconds}s`;
      } else {
        timer.textContent = `${days}j ${hours}h ${minutes}m ${seconds}s`;
      }
    }

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    const conditions = document.getElementById("conditions");

    if (data.giveaway.condition === "solde") {
      conditions.textContent = `Avoir un solde minimum de ${data.giveaway.value} R$`;
    } else if (data.giveaway.condition === "R$") {
      conditions.textContent = `Gagner ${data.giveaway.value} R$ à partir de maintenant`;
    } else if (data.giveaway.condition === "Retraits") {
      conditions.textContent = `Faire ${data.giveaway.value} retrait(s) à partir de maintenant`;
    } else if (data.giveaway.condition === "Offre") {
      conditions.textContent = `Faire ${data.giveaway.value} offre(s) à partir de maintenant`;
    }

    const participateBtn = document.getElementById("participate-btn");
    participateBtn.addEventListener("click", async () => {
      const user = auth.currentUser;
      if (!user) {
        console.log("Utilisateur non connecté");
        return;
      }
      if (data.giveaway.userParticipated) {
        return;
      }
      const res = await fetch(API_BASE_URL + "/api/giveaways/participate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${await user.getIdToken()}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          giveawayId: data.id,
        }),
      });

      const result = await res.json();
      alert(result.message || result.error || "Participation réussie !");
      if (result.success) {
        participateBtn.textContent = "Participation réussie !";
        participateBtn.disabled = true;
      }
    });
  });
});
