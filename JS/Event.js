document.addEventListener("DOMContentLoaded", async function () {
  const { auth, db } = await initFirebase();

  if (!db || !auth) {
    console.error("Firebase n'est pas initialisé !");
    return;
  }

  const user = await waitForUser(auth);

  if (!user) {
    console.log("Utilisateur non connecté");
    return;
  }

  const TEAM_FLAGS = {
    france: "🇫🇷",
    brazil: "🇧🇷",
    argentina: "🇦🇷",
    germany: "🇩🇪",
    spain: "🇪🇸",
    usa: "🇺🇸",
  };

  const TEAM_NAMES = {
    france: "France",
    brazil: "Brésil",
    argentina: "Argentine",
    germany: "Allemagne",
    spain: "Espagne",
    usa: "USA",
  };

  const MISSION_LABELS = {
    offers_1: "Compléter 1 offre",
    offers_3: "Compléter 3 offres",
    offers_10: "Compléter 10 offres",
    offers_25: "Compléter 25 offres",
    robux_50: "Gagner 50 Robux",
    robux_250: "Gagner 250 Robux",
    robux_1000: "Gagner 1000 Robux",
  };

  const MISSION_TARGETS = {
    offers_1: 1,
    offers_3: 3,
    offers_10: 10,
    offers_25: 25,
    robux_50: 50,
    robux_250: 250,
    robux_1000: 1000,
  };

  const MISSION_REWARDS = {
    offers_1: 2,
    offers_3: 3,
    offers_10: 20,
    offers_25: 25,
    robux_50: 50,
    robux_250: 15,
    robux_1000: 75,
  };

  const CHEST_ICONS = {
    chest_10: "📦",
    chest_25: "🎁",
    chest_50: "💎",
    chest_100: "👑",
  };
  const CHEST_REQ = {
    chest_10: 10,
    chest_25: 25,
    chest_50: 50,
    chest_100: 100,
  };

  const LEVEL_DATA = [
    { level: 1, pts: 0, label: "⚽ Recrue", bonus: 0 },
    { level: 2, pts: 50, label: "🟡 Supporter", bonus: 5 },
    { level: 3, pts: 150, label: "🟠 Animateur", bonus: 10 },
    { level: 4, pts: 300, label: "🔴 Ultras", bonus: 20 },
    { level: 5, pts: 600, label: "🟣 Fanatique", bonus: 35 },
    { level: 6, pts: 1200, label: "🔵 Légende", bonus: 60 },
    { level: 7, pts: 2500, label: "⭐ Icône", bonus: 100 },
    { level: 8, pts: 5000, label: "👑 Roi du Monde", bonus: 200 },
  ];

  const BADGE_DEFS = [
    { id: "premier_supporter", label: "Premier Supporter", icon: "🎖️" },
    { id: "fanatique", label: "Fanatique", icon: "🔥" },
    { id: "legende", label: "Légende", icon: "⭐" },
    { id: "roi_pronostics", label: "Roi des Pronostics", icon: "🔮" },
    { id: "top10", label: "Top 10", icon: "🏆" },
  ];

  const STREAK_REWARDS = [0, 1, 1, 2, 2, 3, 3, 4];

  // ----------------------------------------------------------
  // ÉTAT GLOBAL
  // ----------------------------------------------------------

  const state = {
    loading: true,
    activeTab: "home",
    status: null,
    leaderboard: null,
    teamRanking: null,
    matches: null,
    actionLoading: false,
  };

  // ----------------------------------------------------------
  // UTILITAIRES
  // ----------------------------------------------------------

  function notify(msg, color) {
    const el = document.getElementById("fb-notif");
    el.textContent = msg;
    el.style.background = color || "#22c55e";
    el.classList.add("show");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("show"), 3000);
  }

  function waitForUser(auth) {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe(); // important : on stop après le premier event
        resolve(user);
      });
    });
  }

  async function apiRequest(method, path, body) {
    // Adapte la clé localStorage à ton système d'auth existant
    const user = firebase.auth().currentUser;
    const token = user ? await user.getIdToken() : "";
    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token,
      },
    };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch("https://il.bloxrbx.fr" + path, opts);
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "Erreur serveur");
    return data;
  }

  function pct(val, max) {
    if (!max) return 100;
    return Math.min(100, Math.round((val / max) * 100));
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function getCurrentLevel(pts) {
    let cur = LEVEL_DATA[0];
    for (const l of LEVEL_DATA) {
      if (pts >= l.pts) cur = l;
      else break;
    }
    return cur;
  }

  function getNextLevel(pts) {
    return LEVEL_DATA.find((l) => l.pts > pts) || null;
  }

  // ----------------------------------------------------------
  // FETCH DATA
  // ----------------------------------------------------------

  async function fetchStatus() {
    state.status = await apiRequest("GET", "/api/event/football2026/status");
  }

  async function fetchLeaderboard() {
    state.leaderboard = await apiRequest(
      "GET",
      "/api/event/football2026/leaderboard",
    );
  }

  async function fetchTeamRanking() {
    state.teamRanking = await apiRequest(
      "GET",
      "/api/event/football2026/team-ranking",
    );
  }

  async function fetchMatches() {
    state.matches = await apiRequest("GET", "/api/event/football2026/matches");
  }

  // ----------------------------------------------------------
  // RENDU PRINCIPAL
  // ----------------------------------------------------------

  function updateUI() {
    const app = document.getElementById("fb-app");

    if (state.loading) {
      app.innerHTML =
        '<div id="fb-loading">⏳ Chargement de l\'événement…</div>';
      return;
    }

    if (!state.status || !state.status.hasTeam) {
      app.innerHTML = renderTeamPicker();
      attachTeamPickerEvents();
      return;
    }

    app.innerHTML = renderMain();
    attachMainEvents();
  }

  // ----------------------------------------------------------
  // TEAM PICKER
  // ----------------------------------------------------------

  function renderTeamPicker() {
    const teams = Object.entries(TEAM_FLAGS)
      .map(function (entry) {
        const id = entry[0];
        const flag = entry[1];
        return (
          '<button class="team-btn" data-team="' +
          id +
          '">' +
          '<span class="flag">' +
          flag +
          "</span>" +
          '<span class="name">' +
          TEAM_NAMES[id] +
          "</span>" +
          "</button>"
        );
      })
      .join("");

    return (
      '<div class="fb-header">' +
      "<h1>⚽ Football <span>2026</span></h1>" +
      "<p>Rejoins une équipe et deviens le meilleur supporter !</p>" +
      "</div>" +
      '<div class="fb-card">' +
      "<h3>🌍 Choisir ton équipe</h3>" +
      '<p style="color:var(--muted);font-size:.85rem;margin-bottom:16px">Attention : ce choix est définitif.</p>' +
      '<div class="team-grid">' +
      teams +
      "</div>" +
      "</div>"
    );
  }

  function attachTeamPickerEvents() {
    document.querySelectorAll(".team-btn").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        const team = btn.dataset.team;
        if (state.actionLoading) return;
        if (
          !confirm(
            "Rejoindre l'équipe " +
              TEAM_FLAGS[team] +
              " " +
              TEAM_NAMES[team] +
              " ? Ce choix est définitif.",
          )
        )
          return;
        state.actionLoading = true;
        btn.disabled = true;
        try {
          await apiRequest("POST", "/api/event/football2026/choose-team", {
            team,
          });
          await fetchStatus();
          state.actionLoading = false;
          updateUI();
          notify(
            "✅ Tu supportes " +
              TEAM_FLAGS[team] +
              " " +
              TEAM_NAMES[team] +
              " !",
          );
        } catch (e) {
          notify(e.message, "#ef4444");
          state.actionLoading = false;
          btn.disabled = false;
        }
      });
    });
  }

  // ----------------------------------------------------------
  // LAYOUT PRINCIPAL
  // ----------------------------------------------------------

  function renderMain() {
    const s = state.status;

    const tabs = [
      { id: "home", label: "🏠 Accueil" },
      { id: "missions", label: "📋 Missions" },
      { id: "niveaux", label: "🏅 Niveaux" },
      { id: "streak", label: "🔥 Série" },
      { id: "coffres", label: "📦 Coffres" },
      { id: "pronostics", label: "🔮 Pronostics" },
      { id: "classement", label: "🏆 Classement" },
      { id: "equipes", label: "🌍 Équipes" },
    ];

    const tabBar =
      '<div class="fb-tabs">' +
      tabs
        .map(function (t) {
          const active = state.activeTab === t.id ? " active" : "";
          return (
            '<button class="fb-tab' +
            active +
            '" data-tab="' +
            t.id +
            '">' +
            t.label +
            "</button>"
          );
        })
        .join("") +
      "</div>";

    let content = "";
    switch (state.activeTab) {
      case "home":
        content = renderHome();
        break;
      case "missions":
        content = renderMissions();
        break;
      case "niveaux":
        content = renderNiveaux();
        break;
      case "streak":
        content = renderStreak();
        break;
      case "coffres":
        content = renderCoffres();
        break;
      case "pronostics":
        content = renderPronostics();
        break;
      case "classement":
        content = renderClassement();
        break;
      case "equipes":
        content = renderEquipes();
        break;
    }

    const booster = s.boosterActive
      ? '<div class="booster-banner">⚡ Booster x2 Supporter Points actif !</div>'
      : "";

    return (
      '<div class="fb-header">' +
      "<h1>⚽ Football <span>2026</span></h1>" +
      "<p>" +
      (TEAM_FLAGS[s.team] || "") +
      " " +
      (TEAM_NAMES[s.team] || s.team) +
      " — " +
      s.pseudo +
      "</p>" +
      "</div>" +
      booster +
      tabBar +
      content
    );
  }

  // ----------------------------------------------------------
  // ONGLET ACCUEIL
  // ----------------------------------------------------------

  function renderHome() {
    const s = state.status;
    const pts = s.supporterPoints || 0;
    const cur = getCurrentLevel(pts);
    const next = getNextLevel(pts);
    const prog = next ? pct(pts - cur.pts, next.pts - cur.pts) : 100;

    const nextLabel = next
      ? '<p style="font-size:.75rem;color:var(--muted);margin-top:4px">Prochain niveau : ' +
        next.label +
        " — encore " +
        (next.pts - pts) +
        " pts</p>"
      : '<p style="font-size:.75rem;color:var(--yellow);margin-top:4px">🏆 Niveau maximum atteint !</p>';

    const badges = s.badges || {};
    const badgeHtml = BADGE_DEFS.map(function (b) {
      const locked = badges[b.id] ? "" : " locked";
      return (
        '<div class="badge-pill' +
        locked +
        '"><span>' +
        b.icon +
        "</span><span>" +
        b.label +
        "</span></div>"
      );
    }).join("");

    return (
      '<div class="fb-stats-row">' +
      '<div class="fb-stat"><div class="val">' +
      pts +
      '</div><div class="lbl">Supporter Points</div></div>' +
      '<div class="fb-stat"><div class="val">' +
      (s.totalOffers || 0) +
      '</div><div class="lbl">Offres complétées</div></div>' +
      '<div class="fb-stat"><div class="val">' +
      (s.totalRobux || 0) +
      '</div><div class="lbl">Robux gagnés</div></div>' +
      '<div class="fb-stat"><div class="val">' +
      (s.streak || 0) +
      '</div><div class="lbl">Série actuelle 🔥</div></div>' +
      "</div>" +
      '<div class="fb-card">' +
      "<h3>Niveau</h3>" +
      '<div class="lvl-row">' +
      '<span class="lvl-badge">' +
      cur.label +
      "</span>" +
      '<span class="lvl-pts">' +
      pts +
      " pts" +
      (next ? " / " + next.pts : " — MAX") +
      "</span>" +
      "</div>" +
      '<div class="fb-bar"><div class="fb-bar-fill" style="width:' +
      prog +
      '%"></div></div>' +
      nextLabel +
      "</div>" +
      '<div class="fb-card">' +
      "<h3>Badges</h3>" +
      '<div class="badges-grid">' +
      badgeHtml +
      "</div>" +
      "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET MISSIONS
  // ----------------------------------------------------------

  function renderMissions() {
    const missions = state.status.missions || {};
    const totalOffers = state.status.totalOffers || 0;
    const totalRobux = state.status.totalRobux || 0;

    const rows = Object.keys(MISSION_LABELS).map(function (id) {
      const m = missions[id] || {
        progress: 0,
        completed: false,
        claimed: false,
      };
      const target = MISSION_TARGETS[id];
      const reward = MISSION_REWARDS[id];
      const isOffer = id.indexOf("offers") === 0;
      const current = isOffer ? totalOffers : totalRobux;
      const prog = Math.min(current, target);
      const done = prog >= target;
      const barPct = pct(prog, target);

      const action = m.claimed
        ? '<span class="badge-done">✅</span>'
        : '<button class="btn-claim" data-mission="' +
          id +
          '"' +
          (done ? "" : " disabled") +
          ">" +
          (done ? "Réclamer" : "🔒") +
          "</button>";

      return (
        '<div class="mission-item">' +
        '<div class="mission-info">' +
        '<div class="label">' +
        MISSION_LABELS[id] +
        "</div>" +
        '<div class="prog">' +
        prog +
        " / " +
        target +
        "</div>" +
        '<div class="fb-bar" style="margin-top:6px"><div class="fb-bar-fill" style="width:' +
        barPct +
        '%"></div></div>' +
        "</div>" +
        '<div class="mission-reward">+' +
        reward +
        " R$</div>" +
        action +
        "</div>"
      );
    });

    return (
      '<div class="fb-card"><h3>📋 Missions</h3>' + rows.join("") + "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET NIVEAUX
  // ----------------------------------------------------------

  function renderNiveaux() {
    const pts = state.status.supporterPoints || 0;
    const claimed = state.status.claimedLevels || {};

    const rows = LEVEL_DATA.map(function (l) {
      const unlocked = pts >= l.pts;
      const isClaimed = !!claimed[l.level];
      const isCurrent = getCurrentLevel(pts).level === l.level;
      const barPct = unlocked ? 100 : pct(pts, l.pts);

      const currentTag = isCurrent
        ? ' <span style="color:var(--accent);font-size:.75rem">← Actuel</span>'
        : "";

      let action;
      if (l.bonus > 0) {
        action = isClaimed
          ? '<span class="badge-done">✅</span>'
          : '<button class="btn-claim btn-claim-level" data-level="' +
            l.level +
            '"' +
            (unlocked ? "" : " disabled") +
            ">" +
            (unlocked ? "Réclamer" : "🔒") +
            "</button>";
      } else {
        action =
          '<span style="color:var(--muted);font-size:.75rem">Départ</span>';
      }

      return (
        '<div class="mission-item">' +
        '<div class="mission-info">' +
        '<div class="label">' +
        l.label +
        currentTag +
        "</div>" +
        '<div class="prog">' +
        l.pts +
        " pts requis" +
        (l.bonus ? " · +" + l.bonus + " R$ bonus" : "") +
        "</div>" +
        '<div class="fb-bar" style="margin-top:6px"><div class="fb-bar-fill" style="width:' +
        barPct +
        '%"></div></div>' +
        "</div>" +
        action +
        "</div>"
      );
    });

    return (
      '<div class="fb-card"><h3>🏅 Niveaux & Récompenses</h3>' +
      rows.join("") +
      "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET STREAK
  // ----------------------------------------------------------

  function renderStreak() {
    const s = state.status;
    const streak = s.streak || 0;
    const today = new Date().toISOString().slice(0, 10);
    const alreadyClaimed = s.lastLogin === today;

    const days = [1, 2, 3, 4, 5, 6, 7].map(function (d) {
      const active = d <= streak ? " active" : "";
      return (
        '<div class="streak-day' +
        active +
        '">' +
        '<div class="day-n">J' +
        d +
        "</div>" +
        '<div class="day-r">+' +
        STREAK_REWARDS[Math.min(d, 7)] +
        "R$</div>" +
        "</div>"
      );
    });

    const btnLabel = alreadyClaimed
      ? "✅ Déjà réclamé (Série : " + streak + " jours)"
      : "🎁 Réclamer le bonus du jour (+" +
        STREAK_REWARDS[Math.min(streak + 1, 7)] +
        " R$)";

    const infoMsg = alreadyClaimed
      ? "✅ Récompense déjà réclamée aujourd'hui."
      : "Visite chaque jour pour maintenir ta série !";

    return (
      '<div class="fb-card">' +
      "<h3>🔥 Série quotidienne</h3>" +
      '<p style="color:var(--muted);font-size:.85rem;margin-bottom:4px">' +
      infoMsg +
      "</p>" +
      '<div class="streak-days">' +
      days.join("") +
      "</div>" +
      '<button id="btn-daily-login" class="btn-login"' +
      (alreadyClaimed ? " disabled" : "") +
      ">" +
      btnLabel +
      "</button>" +
      "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET COFFRES
  // ----------------------------------------------------------

  function renderCoffres() {
    const chests = state.status.chests || {};
    const totalOff = state.status.totalOffers || 0;

    const items = Object.keys(CHEST_ICONS).map(function (id) {
      const req = CHEST_REQ[id];
      const cs = chests[id] || {};
      const unlocked = totalOff >= req;
      const opened = !!cs.opened;
      const reward = cs.reward || null;

      let rewardHtml = "";
      if (opened && reward) {
        rewardHtml =
          reward.type === "robux"
            ? '<div class="reward-pill">+' + reward.value + " R$</div>"
            : '<div class="reward-pill">⚡ Booster x2 1h</div>';
      }

      const btnLabel = opened
        ? "Ouvert ✅"
        : unlocked
          ? "Ouvrir"
          : "🔒 Verrouillé";

      return (
        '<div class="chest-item' +
        (!unlocked ? " locked" : "") +
        '">' +
        '<span class="icon">' +
        CHEST_ICONS[id] +
        "</span>" +
        '<div class="req">' +
        req +
        " offres</div>" +
        rewardHtml +
        "<br>" +
        '<button class="btn-open" data-chest="' +
        id +
        '"' +
        (!unlocked || opened ? " disabled" : "") +
        ">" +
        btnLabel +
        "</button>" +
        "</div>"
      );
    });

    return (
      '<div class="fb-card">' +
      "<h3>📦 Coffres Supporters</h3>" +
      '<div class="chest-grid">' +
      items.join("") +
      "</div>" +
      "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET PRONOSTICS
  // ----------------------------------------------------------

  function renderPronostics() {
    if (!state.matches) {
      return '<div class="fb-card"><h3>🔮 Pronostics</h3><p style="color:var(--muted)">Chargement…</p></div>';
    }

    const matches = state.matches.matches || [];
    if (!matches.length) {
      return '<div class="fb-card"><h3>🔮 Pronostics</h3><p style="color:var(--muted)">Aucun match disponible pour le moment.</p></div>';
    }

    const cards = matches.map(function (m) {
      const closed = Date.now() > m.date || !!m.result;
      const myPred = m.myPrediction;

      function btnClass(pred) {
        if (!m.result) return myPred === pred ? "selected" : "";
        if (pred === m.result) return "correct";
        if (myPred === pred) return "wrong";
        return "";
      }

      const disabled = closed || myPred ? " disabled" : "";

      const resultLine = m.result
        ? '<div class="match-result-label">Résultat : ' +
          (m.result === "home"
            ? m.homeTeam
            : m.result === "away"
              ? m.awayTeam
              : "Match nul") +
          "</div>"
        : "";

      const wonLine =
        myPred && m.result && myPred === m.result
          ? '<div class="match-reward-label">🎉 +' +
            m.reward +
            " R$ gagnés !</div>"
          : "";

      return (
        '<div class="match-card">' +
        '<div class="match-teams">' +
        "<span>" +
        m.homeTeam +
        "</span>" +
        '<span class="match-vs">vs</span>' +
        "<span>" +
        m.awayTeam +
        "</span>" +
        "</div>" +
        '<div class="match-date">' +
        fmtDate(m.date) +
        " · Récompense : +" +
        m.reward +
        " R$</div>" +
        '<div class="match-btns">' +
        '<button class="btn-pred ' +
        btnClass("home") +
        '" data-match="' +
        m.id +
        '" data-pred="home"' +
        disabled +
        ">🏠 " +
        m.homeTeam +
        "</button>" +
        '<button class="btn-pred ' +
        btnClass("draw") +
        '" data-match="' +
        m.id +
        '" data-pred="draw"' +
        disabled +
        ">🤝 Nul</button>" +
        '<button class="btn-pred ' +
        btnClass("away") +
        '" data-match="' +
        m.id +
        '" data-pred="away"' +
        disabled +
        ">✈️ " +
        m.awayTeam +
        "</button>" +
        "</div>" +
        resultLine +
        wonLine +
        "</div>"
      );
    });

    return (
      '<div class="fb-card"><h3>🔮 Pronostics</h3>' + cards.join("") + "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET CLASSEMENT INDIVIDUEL
  // ----------------------------------------------------------

  function renderClassement() {
    if (!state.leaderboard) {
      return '<div class="fb-card"><h3>🏆 Classement</h3><p style="color:var(--muted)">Chargement…</p></div>';
    }

    const lb = state.leaderboard.leaderboard || [];
    const myRk = state.leaderboard.myRank;

    function rankIcon(r) {
      return r === 1 ? "🥇" : r === 2 ? "🥈" : r === 3 ? "🥉" : r;
    }
    function rankCls(r) {
      return r === 1 ? "gold" : r === 2 ? "silver" : r === 3 ? "bronze" : "";
    }

    const rows = lb
      .map(function (u) {
        const meClass = u.isMe ? " me" : "";
        const meLabel = u.isMe ? " (Toi)" : "";
        return (
          '<div class="lb-row">' +
          '<div class="lb-rank ' +
          rankCls(u.rank) +
          '">' +
          rankIcon(u.rank) +
          "</div>" +
          '<div class="lb-pseudo' +
          meClass +
          '">' +
          u.pseudo +
          meLabel +
          "</div>" +
          '<div class="lb-team">' +
          (TEAM_FLAGS[u.team] || "") +
          "</div>" +
          '<div class="lb-pts">' +
          u.supporterPoints +
          " pts</div>" +
          "</div>"
        );
      })
      .join("");

    const hasMe = lb.some(function (u) {
      return u.isMe;
    });
    const meInfo =
      myRk && !hasMe
        ? '<p style="margin-top:12px;font-size:.8rem;color:var(--muted)">Ta position : #' +
          myRk +
          "</p>"
        : "";

    return (
      '<div class="fb-card"><h3>🏆 Top 100 Supporters</h3>' +
      rows +
      meInfo +
      "</div>"
    );
  }

  // ----------------------------------------------------------
  // ONGLET CLASSEMENT ÉQUIPES
  // ----------------------------------------------------------

  function renderEquipes() {
    if (!state.teamRanking) {
      return '<div class="fb-card"><h3>🌍 Équipes</h3><p style="color:var(--muted)">Chargement…</p></div>';
    }

    const teams = state.teamRanking.teams || [];
    const myTeam = state.status.team;

    const rows = teams
      .map(function (t) {
        const isMe = t.name === myTeam;
        const nameStyle = isMe
          ? 'style="color:var(--accent);font-weight:800"'
          : "";
        const meTag = isMe ? " ← Mon équipe" : "";

        return (
          '<div class="team-rank-row">' +
          '<span class="team-flag">' +
          (TEAM_FLAGS[t.name] || "🏳️") +
          "</span>" +
          '<span class="team-name" ' +
          nameStyle +
          ">" +
          (TEAM_NAMES[t.name] || t.name) +
          meTag +
          "</span>" +
          '<span class="team-members">' +
          (t.members || 0) +
          " supporters</span>" +
          '<span class="team-score">' +
          (t.score || 0) +
          " pts</span>" +
          "</div>"
        );
      })
      .join("");

    return (
      '<div class="fb-card">' +
      "<h3>🌍 Classement des Équipes</h3>" +
      '<p style="color:var(--muted);font-size:.8rem;margin-bottom:12px">L\'équipe gagnante reçoit un bonus Robux pour tous ses membres !</p>' +
      rows +
      "</div>"
    );
  }

  // ----------------------------------------------------------
  // EVENTS PRINCIPAUX
  // ----------------------------------------------------------

  function attachMainEvents() {
    // ── Tabs
    document.querySelectorAll(".fb-tab").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        state.activeTab = btn.dataset.tab;
        if (state.activeTab === "classement" && !state.leaderboard) {
          await fetchLeaderboard().catch(function () {});
        }
        if (state.activeTab === "equipes" && !state.teamRanking) {
          await fetchTeamRanking().catch(function () {});
        }
        if (state.activeTab === "pronostics" && !state.matches) {
          await fetchMatches().catch(function () {});
        }
        updateUI();
      });
    });

    // ── Daily login
    const btnLogin = document.getElementById("btn-daily-login");
    if (btnLogin) {
      btnLogin.addEventListener("click", async function () {
        if (state.actionLoading) return;
        state.actionLoading = true;
        btnLogin.disabled = true;
        try {
          const res = await apiRequest(
            "POST",
            "/api/event/football2026/daily-login",
          );
          if (res.alreadyClaimed) {
            notify("Déjà réclamé aujourd'hui !");
          } else {
            notify("🔥 Série J" + res.day + " — +" + res.reward + " R$ !");
          }
          await fetchStatus();
          state.actionLoading = false;
          updateUI();
        } catch (e) {
          notify(e.message, "#ef4444");
          state.actionLoading = false;
          btnLogin.disabled = false;
        }
      });
    }

    // ── Claim mission
    document
      .querySelectorAll(".btn-claim[data-mission]")
      .forEach(function (btn) {
        btn.addEventListener("click", async function () {
          if (state.actionLoading) return;
          state.actionLoading = true;
          btn.disabled = true;
          try {
            const res = await apiRequest(
              "POST",
              "/api/event/football2026/claim-mission",
              { missionId: btn.dataset.mission },
            );
            notify("✅ Mission réclamée ! +" + res.reward + " R$");
            await fetchStatus();
            state.actionLoading = false;
            updateUI();
          } catch (e) {
            notify(e.message, "#ef4444");
            state.actionLoading = false;
            btn.disabled = false;
          }
        });
      });

    // ── Claim level
    document.querySelectorAll(".btn-claim-level").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (state.actionLoading) return;
        state.actionLoading = true;
        btn.disabled = true;
        try {
          const res = await apiRequest(
            "POST",
            "/api/event/football2026/claim-level",
            { level: parseInt(btn.dataset.level, 10) },
          );
          notify("🏅 Niveau " + res.level + " réclamé ! +" + res.bonus + " R$");
          await fetchStatus();
          state.actionLoading = false;
          updateUI();
        } catch (e) {
          notify(e.message, "#ef4444");
          state.actionLoading = false;
          btn.disabled = false;
        }
      });
    });

    // ── Open chest
    document.querySelectorAll(".btn-open[data-chest]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (state.actionLoading) return;
        state.actionLoading = true;
        btn.disabled = true;
        try {
          const res = await apiRequest(
            "POST",
            "/api/event/football2026/open-chest",
            { chestId: btn.dataset.chest },
          );
          const r = res.reward;
          if (r.type === "robux") {
            notify("📦 Coffre ouvert ! +" + r.value + " R$ !");
          } else {
            notify("📦 Coffre ouvert ! ⚡ Booster x2 pendant 1h !");
          }
          await fetchStatus();
          state.actionLoading = false;
          updateUI();
        } catch (e) {
          notify(e.message, "#ef4444");
          state.actionLoading = false;
          btn.disabled = false;
        }
      });
    });

    // ── Pronostics
    document.querySelectorAll(".btn-pred[data-match]").forEach(function (btn) {
      btn.addEventListener("click", async function () {
        if (state.actionLoading) return;
        state.actionLoading = true;
        btn.disabled = true;
        try {
          await apiRequest("POST", "/api/event/football2026/predict", {
            matchId: btn.dataset.match,
            prediction: btn.dataset.pred,
          });
          notify("🔮 Pronostic enregistré !");
          await fetchMatches();
          state.actionLoading = false;
          updateUI();
        } catch (e) {
          notify(e.message, "#ef4444");
          state.actionLoading = false;
          btn.disabled = false;
        }
      });
    });
  }

  // ----------------------------------------------------------
  // INIT
  // ----------------------------------------------------------

  try {
    await fetchStatus();
    state.loading = false;
    updateUI();
  } catch (e) {
    document.getElementById("fb-app").innerHTML =
      '<div id="fb-error">❌ Impossible de charger l\'événement.<br><small>' +
      e.message +
      "</small></div>";
  }
});
