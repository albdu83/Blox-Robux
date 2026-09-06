const API_BASE_URL = "https://vps.bloxrbx.fr";

let RobloxP = null;
let ID = null;
let userN = null;
let loginWidgetId = null;
let recoverWidgetId = null;

if (!window.firebaseReady) {
  window.firebaseReady = (async () => {
    const res = await fetch("https://api.bloxrbx.fr/firebase-config", {
      method: "POST",
    });
    const config = await res.json();

    firebase.initializeApp(config);

    window.auth = firebase.auth();
    window.db = firebase.database();

    return { auth: window.auth, db: window.db };
  })();
}

window.onRecaptchaLoad = function () {
  const loginContainer = document.getElementById("recaptcha-login");
  if (loginContainer) {
    loginWidgetId = grecaptcha.render("recaptcha-login", {
      sitekey: "6LfYrkUsAAAAAP1-Oe9wb5F3u5p67hNg_92-ug-W",
    });
  }
};

function ensureRecoverCaptcha() {
  const recoverContainer = document.getElementById("recaptcha-recover1");
  if (
    recoverContainer &&
    recoverWidgetId === null &&
    typeof grecaptcha !== "undefined"
  ) {
    recoverWidgetId = grecaptcha.render("recaptcha-recover1", {
      sitekey: "6LfYrkUsAAAAAP1-Oe9wb5F3u5p67hNg_92-ug-W",
    });
  }
}

function initFirebase() {
  return window.firebaseReady; // toujours la même promesse
}

async function fetchCsrfToken() {
  const res = await fetch(`${API_BASE_URL}/getCsrfToken`, {
    credentials: "include", // important pour inclure les cookies
  });
  const data = await res.json();
  return data.token;
}

document.addEventListener("DOMContentLoaded", async () => {
  const loadimg = document.querySelectorAll(".loadimg");

  if (loadimg) {
    loadimg.forEach((img) => {
      img.style.display = "none";
    });
  }

  const { auth, db } = await initFirebase();

  /* =======================
    AUTH STATE (SOURCE UNIQUE)
    ======================= */
  const btnprofil = document.getElementById("btn-profil");
  const disco = document.getElementById("disconnect");
  const body = document.getElementById("body");
  const loadinggif = document.getElementById("sous-container-wrapper");
  const elements = document.getElementById("lien-profil");
  const btnInscription = document.getElementById("btn-inscription");
  const btnConnexion = document.getElementById("btn-connexion");
  const switch2 = document.getElementById("drawer-disabled");
  const title = document.getElementById("Titre");
  const content = document.getElementById("Contenu");
  if (loadinggif) loadinggif.style.display = "flex";
  if (btnprofil) btnprofil.style.display = "none";

  //----------------------//
  // REQUETE POUR MESSAGE //
  //----------------------//

  const MessgaeDis = document.getElementById("messageDis");
  const distitre = document.getElementById("distitre");
  const discontexte = document.getElementById("discontexte");
  const messageContainer = document.getElementById("message-dis-container");
  const start = document.getElementById("start");
  const countmember = document.getElementById("countmember");
  const robuxnumber = document.getElementById("robuxnumber");
  const btnAccueil = document.getElementById("btnAccueil");
  const btnRetour = document.getElementById("btn-Retour");

  function scrambleText(el, finalText, duration = 1000) {
    const chars = "0123456789";
    const start = performance.now();

    function update(now) {
      const progress = (now - start) / duration;

      let output = "";

      for (let i = 0; i < finalText.length; i++) {
        const revealPoint = (i + 1) / finalText.length;

        if (progress >= revealPoint) {
          output += finalText[i];
        } else {
          output += chars[Math.floor(Math.random() * chars.length)];
        }
      }

      el.textContent = output;

      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        el.textContent = finalText;
      }
    }

    requestAnimationFrame(update);
  }

  let evtSource;

  let lastCount = null;
  let lastRobux = null;

  function LoadMessage() {
    if (evtSource) evtSource.close();

    if (MessgaeDis || switch2 || countmember) {
      evtSource = new EventSource(`${API_BASE_URL}/discord/getannounce`);

      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // =========================
        // COUNT
        // =========================

        if (countmember && data.count != null) {
          const newCount = String(data.count);
          const newRobux = String(data.Robux);

          // COUNT
          if (newCount !== lastCount) {
            lastCount = newCount;

            countmember.dataset.value = newCount;

            requestAnimationFrame(() => {
              const rect = countmember.getBoundingClientRect();

              const inView = rect.top < window.innerHeight && rect.bottom > 0;

              if (inView) {
                scrambleText(countmember, newCount);
              } else {
                countmember.textContent = newCount;
              }
            });
          }

          // ROBUX
          if (newRobux !== lastRobux) {
            lastRobux = newRobux;

            robuxnumber.dataset.value = newRobux;

            requestAnimationFrame(() => {
              const rect2 = robuxnumber.getBoundingClientRect();

              const inView2 =
                rect2.top < window.innerHeight && rect2.bottom > 0;

              if (inView2) {
                scrambleText(robuxnumber, newRobux);
              } else {
                robuxnumber.textContent = newRobux;
              }
            });
          }
        }

        // =========================
        // MESSAGE
        // =========================

        if (messageContainer) {
          messageContainer.style.display = data.messageEnabled
            ? "flex"
            : "none";
        }

        if (switch2) {
          switch2.checked = !!data.messageEnabled;
        }

        if (title) {
          title.value = data.Titre || "";
        }

        if (content) {
          content.innerHTML = DOMPurify.sanitize(data.Contexte || "");
        }

        if (distitre) {
          distitre.textContent = data.Titre || "";
        }

        if (discontexte) {
          discontexte.innerHTML = DOMPurify.sanitize(data.Contexte || "");
        }
      };

      evtSource.onerror = () => {
        console.warn("SSE reconnecting...");
      };
    }
  }

  await LoadMessage();

  const el = document.querySelectorAll(".fade-in");

  const observer2 = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("show");
        } else {
          // hors écran → disparition
          entry.target.classList.remove("show");
        }
      });
    },
    {
      threshold: 0.2, // déclenche quand 20% visible
    },
  );

  el.forEach((el) => observer2.observe(el));

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          scrambleText(entry.target, entry.target.dataset.value);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.5 },
  );

  if (countmember) {
    robuxnumber.dataset.value = robuxnumber.textContent;
    countmember.dataset.value = countmember.textContent;
    observer.observe(robuxnumber);
    observer.observe(countmember);
  }

  auth.onAuthStateChanged(async (user) => {
    const sign = document.querySelectorAll(".start");
    if (!user) {
      console.log("Aucun utilisateur connecté");
      if (disco && body) {
        disco.style.display = "flex";
        body.innerHTML = "";
      }
      if (sign) {
        sign.forEach((btn) => {
          btn.addEventListener("click", () => {
            navigate("../Authentification/inscription");
          });
        });
      }
      return;
    } else {
      if (elements) {
        elements.style.display = "none";
      }

      if (btnAccueil) {
        btnAccueil.style.display = "none";
      }

      if (btnRetour) {
        btnRetour.style.display = "none";
      }

      if (btnInscription) {
        btnInscription.style.display = "none";
      }

      if (btnConnexion) {
        btnConnexion.style.display = "none";
      }

      if (sign) {
        sign.forEach((btn) => {
          btn.addEventListener("click", () => {
            navigate("../Pages/Offres");
          });
        });
      }

      if (loadimg) {
        loadimg.forEach((img) => {
          img.style.display = "flex";
        });
      }
    }
    await checkAndFixRobloxName(user);
    const uid = user.uid;

    try {
      const snapshot = await db.ref("users/" + uid).get();
      if (!snapshot.exists()) {
        await auth.signOut();
        return;
      }

      const data = snapshot.val();
      if (data.isBanned === true) {
        await auth.signOut();
        document.body.innerHTML = ""; // nettoie l’UI
        window.location.replace("../Pages/Ban"); // plus sûr que href
        return;
      }

      const { username, RobloxName, firstUsername } = data;
      RobloxP = RobloxName;
      userN = username;

      /* ===== AVATAR ROBLOX ===== */

      await setRobloxAvatar(RobloxName);

      /* ===== PROFIL HEADER ===== */
      const lienprofil = document.getElementById("lien-profil");
      if (lienprofil) {
        lienprofil.href = "Pages/Profil";
        lienprofil.style.justifyContent = "center";
        const span = lienprofil.querySelector("span");
        if (elements) {
          elements.style.display = "flex";
        }

        if (btnAccueil) {
          btnAccueil.style.display = "flex";
        }

        if (btnRetour) {
          btnRetour.style.display = "flex";
        }

        if (btnInscription) {
          btnInscription.style.display = "flex";
        }

        if (btnConnexion) {
          btnConnexion.style.display = "flex";
        }
        if (loadimg) {
          loadimg.forEach((img) => {
            img.style.display = "none";
          });
        }
        if (span) span.textContent = `${username}`;
      }

      const isMobile = () => window.matchMedia("(max-width: 460px)").matches;

      let currentUrl = null;
      let currentMode = null;
      const loadedTabs = new Set();

      /* =========================
   IFRAME FACTORY
========================= */
      const createIframe = (src, options = {}) => {
        const iframe = document.createElement("iframe");

        iframe.src = src;
        iframe.width = "100%";
        iframe.height = options.height || "700";
        iframe.frameBorder = "0";
        iframe.loading = "lazy";

        if (options.allow) iframe.allow = options.allow;

        return iframe;
      };

      /* =========================
   VIEWER SYSTEM (MOBILE)
========================= */
      function openViewer(url) {
        const viewerPage = document.getElementById("offer-viewer-page");
        const grid = document.querySelectorAll(".offers-grid");
        const pres = document.querySelectorAll(".offers_pres");
        const desc = document.querySelectorAll(".offers_desc");
        const medias = document.getElementById("medias-grid");
        const presentation = document.getElementById("presentation");
        const container = document.getElementById("iframe-container");

        if (!viewerPage || !grid || !container) return;

        currentUrl = url;

        container.innerHTML = "";
        container.appendChild(createIframe(url, { height: "100%" }));
        presentation.style.display = "none";
        grid.forEach((elements) => {
          elements.style.display = "none";
        });
        pres.forEach((elements) => {
          elements.style.display = "none";
        });
        desc.forEach((elements) => {
          elements.style.display = "none";
        });
        medias.style.display = "none";
        viewerPage.classList.remove("hidden");
      }

      function closeViewer() {
        const viewerPage = document.getElementById("offer-viewer-page");
        const grid = document.querySelectorAll(".offers-grid");
        const pres = document.querySelectorAll(".offers_pres");
        const desc = document.querySelectorAll(".offers_desc");
        const medias = document.getElementById("medias-grid");
        const presentation = document.getElementById("presentation");
        const container = document.getElementById("iframe-container");

        if (!viewerPage || !grid || !container) return;

        container.innerHTML = "";

        viewerPage.classList.add("hidden");
        presentation.style.display = "block";
        grid.forEach((elements) => {
          elements.style.display = "grid";
        });
        pres.forEach((elements) => {
          elements.style.display = "block";
        });
        desc.forEach((elements) => {
          elements.style.display = "block";
        });
        medias.style.display = "grid";
      }

      /* =========================
   OFFERS LOADERS (DESKTOP)
========================= */

      async function getCPXUrl() {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/CPXHASH`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("CPX request failed");

        const data = await res.json();
        return data.iframeUrl;
      }

      async function loadCPX(container) {
        if (!container) return;

        try {
          const url = await getCPXUrl();

          container.innerHTML = "";
          container.appendChild(
            createIframe(url.toString(), { allow: "camera; microphone" }),
          );

          loadinggif?.style && (loadinggif.style.display = "none");
        } catch (err) {
          console.error("CPX error:", err);
        }
      }

      async function getTimeWallUrl() {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/timewallhash`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("TimeWall request failed");

        const data = await res.json();
        return data.url;
      }

      async function loadTimeWall(container) {
        if (!container) return;

        container.innerHTML = "";

        const url = await getTimeWallUrl();

        container.appendChild(
          createIframe(url.toString(), {
            allow: "encrypted-media; accelerometer; gyroscope;",
          }),
        );
      }

      async function getTheoremUrl() {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/offer-url/theorem`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        return data.url; // l'URL est construite côté serveur
      }

      async function loadTheoremReach(container) {
        if (!container) return;

        container.innerHTML = "";

        const url = await getTheoremUrl();

        container.appendChild(
          createIframe(url.toString(), {
            allow: "accelerometer; gyroscope; magnetometer; camera; microphone",
          }),
        );
      }

      async function getLootablyUrl() {
        const token = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/LOOTABLYHASH`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        });
        const data = await res.json();
        return data.url; // l'URL est construite côté serveur
      }

      async function loadLootably(container) {
        if (!container) return;

        container.innerHTML = "";

        const url = await getLootablyUrl();

        container.appendChild(
          createIframe(url.toString(), {
            allow: "accelerometer; gyroscope; magnetometer; camera; microphone; unload; encrypted-media;",
          }),
        );
      }
      /* =========================
   MOBILE CARDS SYSTEM
========================= */
      function initMobileOffers() {
        const grid = document.querySelectorAll(".offers-grid");
        if (grid) {
          grid.forEach((element) => {
            element.removeEventListener("click", handleOfferClick);
            element.addEventListener("click", handleOfferClick);
          });
        }
        const medias_grid = document.getElementById("medias-grid");
        if (medias_grid) {
          const mediaClickHandler = handleImgClick(".media_img");

          medias_grid.removeEventListener("click", mediaClickHandler);
          medias_grid.addEventListener("click", mediaClickHandler);
        }
      }

      async function handleOfferClick(e) {
        const card = e.target.closest(".offer-card");
        if (!card) return;

        const type = card.dataset.offer;

        try {
          let url = null;

          if (type === "cpx") {
            url = await getCPXUrl();
          } else if (type === "timewall") {
            url = await getTimeWallUrl();
          } else if (type === "theorem") {
            url = await getTheoremUrl();
          } else if (type === "lootably") {
            url = await getLootablyUrl();
          }

          if (url) openViewer(url);
        } catch (err) {
          console.error("Mobile offer error:", err);
        }
      }

      /* =========================
   DESKTOP LOADER
========================= */
      function loadDesktopOffers() {
        loadTabOffer("cpx");

        // Charge les autres à la demande au clic sur le tab
        document.querySelectorAll(".tab-btn").forEach((tab) => {
          tab.addEventListener("click", () => {
            loadTabOffer(tab.dataset.tab);
          });
        });

        const deskmedia_grid = document.getElementById("deskmedia-grid");
        if (deskmedia_grid) {
          const mediaClickHandler = handleImgClick(".Desk_media_img");

          deskmedia_grid.removeEventListener("click", mediaClickHandler);
          deskmedia_grid.addEventListener("click", mediaClickHandler);
        }
      }

      async function loadTabOffer(tabName) {
        if (loadedTabs.has(tabName)) return; // déjà chargé → ne recharge pas
        loadedTabs.add(tabName);

        if (tabName === "cpx") {
          await loadCPX(document.getElementById("offerwall1"));
        } else if (tabName === "timewall") {
          await loadTimeWall(document.getElementById("timewall-container"));
        } else if (tabName === "theoremreach") {
          await loadTheoremReach(document.getElementById("theoremecontainer"));
        } else if (tabName === "lootably") {
          await loadLootably(document.getElementById("lootablycontainer"));
        }
      }

      function activateTab(tabName) {
        tabs.forEach((btn) => {
          btn.classList.toggle("active", btn.dataset.tab === tabName);
        });
        panels.forEach((panel) => {
          panel.classList.toggle("active", panel.dataset.panel === tabName);
        });

        // ✅ Charge l'offre seulement quand on clique dessus
        if (!isMobile()) loadTabOffer(tabName);
      }

      /* =========================
   INIT SYSTEM (CLEAN SWITCH)
========================= */
      function initOffers() {
        const mobile = isMobile();

        if (mobile === currentMode) return;
        currentMode = mobile;

        document.querySelectorAll("iframe").forEach((i) => i.remove());
        loadedTabs.clear();

        if (mobile) {
          initMobileOffers();
        } else {
          loadDesktopOffers();
        }
      }

      function handleImgClick(selector) {
        return async function (e) {
          const card = e.target.closest(selector);
          if (!card) return;

          const type = card.dataset.link;
          if (!type) return;

          try {
            const token = await user.getIdToken();

            await fetch(`${API_BASE_URL}/mediaCheck`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer " + token,
              },
              body: JSON.stringify({ type }),
            });
          } catch (err) {
            console.error(err);
          }
        };
      }
      /* =========================
   BUTTONS
========================= */
      document
        .getElementById("back-btn")
        ?.addEventListener("click", closeViewer);

      document.getElementById("open-btn")?.addEventListener("click", () => {
        if (currentUrl) window.open(currentUrl, "_blank");
      });

      /* =========================
   START
========================= */
      initOffers();
      let resizeTimeout;

      window.addEventListener("resize", () => {
        clearTimeout(resizeTimeout);

        resizeTimeout = setTimeout(() => {
          initOffers();
        }, 150);
      });

      /* ===== BOUTONS ===== */
      const warn = document.getElementById("warn");
      if (warn) warn.style.display = "none";

      if (btnInscription && btnConnexion) {
        btnInscription.textContent = "Déconnexion";
        btnInscription.removeAttribute("href");
        btnInscription.style.cursor = "pointer";
        btnprofil.style.display = "flex";
        btnprofil.textContent = "Profil";
        btnConnexion.textContent = "Commencer";
        btnConnexion.href = "./Pages/Offres";

        btnInscription.onclick = () => {
          if (warn) warn.style.display = "flex";
        };
      } else if (lienprofil) {
        lienprofil.href = "../Pages/Profil";
      }
    } catch (err) {
      if (err.message && err.message.includes("Permission denied")) {
        console.warn(
          "Vous n'avez pas la permission d'accéder à vos données (banni)",
        );
        await auth.signOut();
        document.body.innerHTML = "";
        window.location.replace("../Pages/Ban");
      } else {
        console.error("Erreur chargement profil :", err);
      }
    }
  });

  /* =======================
   BASCULE ENTRE VUES (login / recover1 / recover2)
======================= */
  function switchView(view) {
    const views = {
      login: document.getElementById("form-connexion"),
      recover1: document.getElementById("form-recuperation-step1"),
      recover2: document.getElementById("form-recuperation-step2"),
    };
    Object.entries(views).forEach(([key, el]) => {
      if (el) el.style.display = key === view ? "flex" : "none";
    });
  }

  document.querySelectorAll(".switch-view").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.preventDefault();
      const view = el.dataset.view;
      if (view === "recover1") ensureRecoverCaptcha();
      switchView(view);
    });
  });

  function showRecoveryCodesModal(codes, onConfirm) {
    const modal = document.getElementById("recoveryModal");
    const codeField = document.getElementById("recoveryCode");
    const copyBtn = document.getElementById("copyRecovery");
    const downloadBtn = document.getElementById("downloadRecovery");
    const confirmBtn = document.getElementById("confirmRecovery");

    // Pas de modal sur cette page (sécurité si le HTML n'est pas encore à jour)
    if (!modal || !codeField) {
      onConfirm();
      return;
    }

    const codesText = codes.join("\n");
    codeField.value = codesText;
    modal.classList.remove("hidden");

    copyBtn.onclick = () => {
      navigator.clipboard.writeText(codesText).then(() => {
        copyBtn.textContent = "Copié ✅";
        setTimeout(() => (copyBtn.textContent = "Copier"), 1200);
      });
    };

    downloadBtn.onclick = () => {
      const blob = new Blob([codesText], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bloxrbx-codes-recuperation.txt";
      a.click();
      URL.revokeObjectURL(url);
    };

    confirmBtn.onclick = () => {
      modal.classList.add("hidden");
      onConfirm();
    };
  }

  /* =======================
     INSCRIPTION
  ======================= */
  const gif = document.getElementById("loading");
  const inscription = document.getElementById("ininscription");
  const formInscription = document.getElementById("form-inscription");

  if (formInscription) {
    formInscription.addEventListener("submit", async (e) => {
      e.preventDefault();

      inscription.style.display = "none";
      gif.style.display = "block";

      const username = document.getElementById("username").value.trim();
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;
      const RobloxName = document.getElementById("RobloxName").value.trim();

      // ✅ Vérifications côté client
      if (password !== confirmPassword) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert("Les mots de passe ne correspondent pas ❌");
        return;
      }

      if (password.length < 8) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert("Le mot de passe doit contenir au moins 8 caractères ❌");
        return;
      }

      if (!username || username.length < 3) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert("Nom d'utilisateur invalide ❌");
        return;
      }

      const token = grecaptcha.getResponse();
      if (!token) {
        gif.style.display = "none";
        inscription.style.display = "block";
        alert("Veuillez cocher le CAPTCHA ❌");
        return;
      }

      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch(`${API_BASE_URL}/signup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password,
            RobloxName,
            captcha: token,
          }),
        });

        const data = await res.json();

        if (data.error) {
          gif.style.display = "none";
          inscription.style.display = "block";
          grecaptcha.reset(); // Réinitialise le CAPTCHA
          alert(data.error);
          return;
        }
        const customToken = data.customToken;
        const recoveryCodes = data.recoveryCodes || [];

        gif.style.display = "none";

        showRecoveryCodesModal(recoveryCodes, async () => {
          try {
            await firebase.auth().signInWithCustomToken(customToken);
            window.location.href = "../Pages/Offres";
          } catch (err) {
            console.error(err);
            inscription.style.display = "block";
            alert("Erreur lors de la connexion avec le token ❌");
          }
        });
      } catch (err) {
        gif.style.display = "none";
        inscription.style.display = "block";
        console.error(err);
        alert("Erreur lors de l'inscription ❌");
      }
    });
  }

  /* =======================
     CONNEXION
  ======================= */
  const formConnexion = document.getElementById("form-connexion");
  const connexion = document.getElementById("inconnexion");

  if (formConnexion) {
    formConnexion.addEventListener("submit", async (e) => {
      e.preventDefault();

      connexion.style.display = "none";
      gif.style.display = "block";

      const username = document.getElementById("loginUsername").value.trim();
      const password = document.getElementById("loginPassword").value;

      if (typeof grecaptcha === "undefined") {
        alert("reCAPTCHA non chargé ❌");
        return;
      }

      if (!username || !password) {
        resetUI();
        return alert("Veuillez remplir tous les champs ❌");
      }

      const captcha = grecaptcha.getResponse(loginWidgetId);
      if (!captcha) {
        resetUI();
        return alert("Veuillez cocher le CAPTCHA ❌");
      }

      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch(`${API_BASE_URL}/login`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({
            username,
            password,
            captcha,
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.token) {
          resetUI();
          grecaptcha.reset(loginWidgetId);
          const msg = data.error || "Connexion échouée ❌";
          return alert(msg);
        }

        if (data.recoveryCodes && data.recoveryCodes.length > 0) {
          showRecoveryCodesModal(data.recoveryCodes, async () => {
            try {
              await firebase.auth().signInWithCustomToken(data.token);
              resetUI();
              alert("Connexion réussie ✅");
              window.location.href = "../Pages/Offres";
            } catch (err) {
              console.error(err);
              resetUI();
              alert("Erreur serveur ❌");
            }
          });
          return;
        }

        // 🔐 Connexion Firebase
        await firebase.auth().signInWithCustomToken(data.token);

        resetUI();
        alert("Connexion réussie ✅");
        window.location.href = "../Pages/Offres";
      } catch (err) {
        console.error(err);
        resetUI();
        alert("Erreur serveur ❌");
      }
    });
  }

  function resetUI() {
    gif.style.display = "none";
    connexion.style.display = "block";
  }

  /* =======================
   RÉCUPÉRATION DE COMPTE
======================= */
  const formRecuperationStep1 = document.getElementById(
    "form-recuperation-step1",
  );
  const formRecuperationStep2 = document.getElementById(
    "form-recuperation-step2",
  );
  const gifRecover1 = document.getElementById("loading2");
  const gifRecover2 = document.getElementById("loading3");

  let pendingResetToken = null;

  if (formRecuperationStep1) {
    formRecuperationStep1.addEventListener("submit", async (e) => {
      e.preventDefault();

      formRecuperationStep1.style.display = "none";
      gifRecover1.style.display = "block";

      const username = document.getElementById("recUsername").value.trim();
      const code = document.getElementById("recCode").value.trim();

      if (typeof grecaptcha === "undefined") {
        gifRecover1.style.display = "none";
        formRecuperationStep1.style.display = "flex";
        return alert("reCAPTCHA non chargé ❌");
      }

      const captcha = grecaptcha.getResponse(recoverWidgetId);
      if (!captcha) {
        gifRecover1.style.display = "none";
        formRecuperationStep1.style.display = "flex";
        return alert("Veuillez cocher le CAPTCHA ❌");
      }

      if (!username || !code) {
        gifRecover1.style.display = "none";
        formRecuperationStep1.style.display = "flex";
        return alert("Veuillez remplir tous les champs ❌");
      }

      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch(`${API_BASE_URL}/recover/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({ username, code, captcha }),
        });

        const data = await res.json();

        if (!res.ok || !data.resetToken) {
          gifRecover1.style.display = "none";
          formRecuperationStep1.style.display = "flex";
          grecaptcha.reset(recoverWidgetId);
          return alert(data.error || "Code invalide ❌");
        }

        pendingResetToken = data.resetToken;

        gifRecover1.style.display = "none";
        formRecuperationStep2.style.display = "flex";
      } catch (err) {
        console.error(err);
        gifRecover1.style.display = "none";
        formRecuperationStep1.style.display = "flex";
        alert("Erreur serveur ❌");
      }
    });
  }

  if (formRecuperationStep2) {
    formRecuperationStep2.addEventListener("submit", async (e) => {
      e.preventDefault();

      if (!pendingResetToken) {
        alert("Session de récupération expirée, recommence depuis le début ❌");
        switchView("recover1");
        return;
      }

      formRecuperationStep2.style.display = "none";
      gifRecover2.style.display = "block";

      const newPassword = document.getElementById("newPassword").value;
      const confirmNewPassword =
        document.getElementById("confirmNewPassword").value;

      if (newPassword.length < 8) {
        gifRecover2.style.display = "none";
        formRecuperationStep2.style.display = "flex";
        return alert("Le mot de passe doit contenir au moins 8 caractères ❌");
      }

      if (newPassword !== confirmNewPassword) {
        gifRecover2.style.display = "none";
        formRecuperationStep2.style.display = "flex";
        return alert("Les mots de passe ne correspondent pas ❌");
      }

      try {
        const csrfToken = await fetchCsrfToken();
        const res = await fetch(`${API_BASE_URL}/recover/reset`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": csrfToken,
          },
          credentials: "include",
          body: JSON.stringify({ resetToken: pendingResetToken, newPassword }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          gifRecover2.style.display = "none";
          formRecuperationStep2.style.display = "flex";
          return alert(data.error || "Erreur lors de la réinitialisation ❌");
        }

        pendingResetToken = null;
        gifRecover2.style.display = "none";
        alert(
          "Mot de passe réinitialisé avec succès ✅ Vous pouvez te reconnecter.",
        );
        switchView("login");
      } catch (err) {
        console.error(err);
        gifRecover2.style.display = "none";
        formRecuperationStep2.style.display = "flex";
        alert("Erreur serveur ❌");
      }
    });
  }

  togglePasswordImage("checkimg4", "newPassword");
  togglePasswordImage("checkimg5", "confirmNewPassword");

  /* =======================
        MENU DEPLOYING
  ======================= */

  const barres = document.getElementById("barres");
  const navigation = document.getElementById("navigation");
  const navpanel = document.getElementById("nav-panel");
  const barres2 = document.getElementById("barres2");

  if (barres) {
    barres.addEventListener("click", () => {
      navigation.classList.toggle("active");
      navpanel.classList.toggle("active");
      barres.classList.toggle("rotated");
    });
  }

  if (barres2) {
    barres2.addEventListener("click", () => {
      navigation.classList.remove("active");
      navpanel.classList.remove("active");
      barres.classList.remove("rotated");
    });
  }

  if (navigation) {
    navigation.addEventListener("click", (e) => {
      if (e.target === navigation) {
        navigation.classList.remove("active");
        navpanel.classList.remove("active");
        barres.classList.remove("rotated");
      }
    });
  }

  /* =======================
        TOGGLE PASSWORD
  ======================= */
  function togglePasswordImage(imgId, inputId) {
    const img = document.getElementById(imgId);
    const input = document.getElementById(inputId);

    if (img && input) {
      img.addEventListener("click", () => {
        if (input.type === "password") {
          input.type = "text";
          img.src = "../img/checked.png"; // optionnel : changer l'image
        } else {
          input.type = "password";
          img.src = "../img/unchecked.png";
        }
      });
    }
  }

  // Appel pour chaque input
  togglePasswordImage("checkimg", "loginPassword");
  togglePasswordImage("checkimg2", "password");
  togglePasswordImage("checkimg3", "confirmPassword");

  document.addEventListener("click", (e) => {
    // Vérifie si on clique sur l'image ou sur le texte
    if (
      !e.target.classList.contains("copy-img") &&
      !e.target.classList.contains("copy-id")
    )
      return;

    const parent = e.target.closest(".copy-id");
    if (!parent) return;

    const idToCopy = parent.dataset.copy;
    if (!idToCopy) return;
    const originalHTML = parent.innerHTML;

    navigator.clipboard
      .writeText(idToCopy)
      .then(() => {
        // Remplace tout le contenu par "Copié ✅"
        parent.innerHTML = "Copié ✅";

        setTimeout(() => {
          // Remet le contenu original après 1,2 seconde
          parent.innerHTML = originalHTML;
        }, 1200);
      })
      .catch(() => alert("Impossible de copier"));
  });

  /* =======================
   AVATAR ROBLOX
======================= */
  async function setRobloxAvatar(robloxName) {
    try {
      const res = await fetch(`${API_BASE_URL}/api/avatar/${robloxName}`);
      const data = await res.json();

      const img = document.getElementById("avatar-roblox");
      if (data.targetId) {
        ID = data.targetId.toString();
      }
      if (!img) return;

      img.src = data.avatarUrl || "img/default-avatar.png";
      img.style.display = "inline-block";
    } catch (err) {
      console.error("Erreur avatar :", err);
    }
  }
