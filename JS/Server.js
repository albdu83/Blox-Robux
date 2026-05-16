const API_BASE_URL = "https://il.bloxrbx.fr";

let RobloxP = null;
let ID = null;
let userN = null;

if (!window.firebaseReady) {
  window.firebaseReady = (async () => {
    const res = await fetch("https://api.bloxrbx.fr/firebase-config", {
      method: "POST"
    });
    const config = await res.json()

    firebase.initializeApp(config);

    window.auth = firebase.auth();
    window.db = firebase.database();

    return { auth: window.auth, db: window.db };
  })();
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

  function LoadMessage() {
    if (evtSource) evtSource.close();

    if (MessgaeDis || switch2 || countmember) {
      evtSource = new EventSource(`${API_BASE_URL}/discord/getannounce`);

      evtSource.onmessage = (event) => {
        const data = JSON.parse(event.data);

        // COUNT animation
        if (data.count && countmember) {
          countmember.dataset.value = data.count;
          robuxnumber.dataset.value = data.Robux;
          const rect = countmember.getBoundingClientRect();
          const inView = rect.top < window.innerHeight && rect.bottom > 0;
          const rect2 = countmember.getBoundingClientRect();
          const inView2 = rect2.top < window.innerHeight && rect2.bottom > 0;

          if (inView) {
            scrambleText(countmember, data.count);
          }
          if (inView2) {
            scrambleText(robuxnumber, data.Robux);
          }
        }

        // MESSAGE ON/OFF
        if (messageContainer) {
          messageContainer.style.display = data.messageEnabled
            ? "flex"
            : "none";
        }

        // SWITCH SAFE
        if (switch2) {
          switch2.checked = !!data.messageEnabled;
        }

        // TITRE / CONTENU SAFE
        if (title) title.value = data.Titre || "";
        if (content)
          content.innerHTML = DOMPurify.sanitize(data.Contexte || "");

        if (distitre) distitre.textContent = data.Titre || "";
        if (discontexte)
          discontexte.innerHTML = DOMPurify.sanitize(data.Contexte || "");
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

        container.appendChild(createIframe(url.toString()));
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
        loadCPX(document.getElementById("offerwall1"));
        loadTimeWall(document.getElementById("timewall-container"));
        loadTheoremReach(document.getElementById("theoremecontainer"));
        const deskmedia_grid = document.getElementById("deskmedia-grid");
        if (deskmedia_grid) {
          const mediaClickHandler = handleImgClick(".Desk_media_img");

          deskmedia_grid.removeEventListener("click", mediaClickHandler);
          deskmedia_grid.addEventListener("click", mediaClickHandler);
        }
      }

      /* =========================
   INIT SYSTEM (CLEAN SWITCH)
========================= */
      function initOffers() {
        const mobile = isMobile();

        if (mobile === currentMode) return;
        currentMode = mobile;

        document.querySelectorAll("iframe").forEach((i) => i.remove());

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
        try {
          await firebase.auth().signInWithCustomToken(customToken);

          // Maintenant que l'utilisateur est connecté
          gif.style.display = "none";
          inscription.style.display = "block";
          alert("Compte créé avec succès ✅");

          // Redirection sûre après login
          window.location.href = "../Pages/Offres";
        } catch (err) {
          gif.style.display = "none";
          inscription.style.display = "block";
          console.error(err);
          alert("Erreur lors de la connexion avec le token ❌");
        }
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

      const captcha = grecaptcha.getResponse();
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
          grecaptcha.reset();
          const msg = data.error || "Connexion échouée ❌";
          return alert(msg);
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
        getPublicsPlaces(data.targetId.toString());
      }
      if (!img) return;

      img.src = data.avatarUrl || "img/default-avatar.png";
      img.style.display = "inline-block";
    } catch (err) {
      console.error("Erreur avatar :", err);
    }
  }

  const rootIdMap = {};
  async function getPublicsPlaces(targetId) {
    if (!targetId) return;

    const select = document.getElementById("public-places");
    if (!select) return;

    const Interface = document.querySelector(".Interface");
    const explain = document.getElementById("explain");
    const HELP = document.getElementById("HELP");
    const tutocontainer = document.getElementById("tutocontainer");
    const href = document.getElementById("href");
    const href2 = document.getElementById("href2");

    let hasChangedOnce = false;

    try {
      /* ======================
       FETCH PLACES
    ====================== */
      const res = await fetch(
        `${API_BASE_URL}/api/places?targetId=${targetId}`,
      );
      const data = await res.json();

      select.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.textContent = "Sélectionner un jeu";
      defaultOption.value = "";
      defaultOption.disabled = true;
      defaultOption.selected = true;
      select.appendChild(defaultOption);

      if (!data?.data?.length) {
        const option = document.createElement("option");
        option.textContent = "Aucun emplacement public trouvé";
        option.disabled = true;
        select.appendChild(option);
        return;
      }

      data.data.forEach((game) => {
        rootIdMap[game.ID] = game.RootID;

        let name = game.name;
        if (name.length > 15) name = name.slice(0, 15) + "...";

        const option = document.createElement("option");
        option.value = game.ID;
        option.textContent = name;

        select.appendChild(option);
      });

      /* ======================
       ON CHANGE (clean)
    ====================== */
      select.addEventListener("change", () => {
        const gameId = select.value;
        if (!gameId) return;

        // update links
        const updateLinks = () => {
          href.href = `https://create.roblox.com/dashboard/creations/experiences/${gameId}/access`;
          href2.href = `https://create.roblox.com/dashboard/creations/experiences/${gameId}/experience-questionnaire`;
        };

        updateLinks();

        // UI first interaction only
        if (!hasChangedOnce) {
          Interface?.classList.add("active9");
          explain?.classList.add("active6");
          HELP?.classList.add("active7");

          explain?.addEventListener(
            "transitionend",
            () => {
              tutocontainer?.classList.add("active10");
              HELP?.classList.add("activeA");
              explain?.classList.add("activeB");
            },
            { once: true },
          );

          hasChangedOnce = true;
          return;
        }

        // subsequent changes (no re-animation spam)
        tutocontainer?.classList.remove("active10");

        tutocontainer?.addEventListener(
          "transitionend",
          () => {
            tutocontainer?.classList.add("active10");
            updateLinks();
          },
          { once: true },
        );
      });
    } catch (err) {
      console.error("Erreur lors de la récupération des places :", err);
    }
  }
  function updateInterfaceSize() {
    const Interface = document.querySelector(".Interface");
    const logoimg = document.getElementById("logoimg");
    if (!Interface) return;

    Interface.classList.remove("tablet", "desktop");

    const width = window.innerWidth;

    if (width >= 1200) {
      Interface.classList.add("desktop");
    } else if (width >= 768) {
      Interface.classList.add("tablet");
    } else if (logoimg) {
      logoimg.style.display = "none";
    }
  }

  async function addTransaction(amount) {
    try {
      const user = firebase.auth().currentUser;
      if (!user) return showError("Utilisateur non connecté");

      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ amount }),
      });
      const data = await res.json();

      if (data.error) return console.error("Problème de la manipulation");
    } catch (err) {
      console.error(err);
      showError("Erreur serveur, réessayez plus tard");
    }
  }

  window.addEventListener("resize", updateInterfaceSize);
  updateInterfaceSize();

  const btn = document.getElementById("buttonretrait");
  const select = document.getElementById("public-places");

  if (!btn || !select) return;

  btn.addEventListener("click", async () => {
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const selectedGameID = select.value;
      const rootID = rootIdMap[selectedGameID];
      if (!rootID) return alert("Place introuvable !");

      if (!selectedGameID) return alert("Sélectionne un jeu");

      const amountEl = document.getElementById("amount");
      const amount = parseFloat(amountEl.value);

      if (!amount) {
        return alert("Utilisateur ou montant invalide");
      }

      const user = firebase.auth().currentUser; // ← utilisateur déjà connu
      if (!user) return alert("Non connecté");

      const token = await user.getIdToken();

      // 1️⃣ Vérifier le solde
      const balanceRes = await fetch(`${API_BASE_URL}/api/getBalance`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ Montant: amount }),
      });

      if (!balanceRes.ok) {
        const errData = await balanceRes.json();
        return alert(
          errData.error || "Erreur lors de la récupération du solde",
        );
      }

      // 2️⃣ Payer le serveur privé

      const payRes = await fetch(`${API_BASE_URL}/api/payServer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // ✅ IMPORTANT
        },
        body: JSON.stringify({
          ID,
          gameId: rootID,
          amount,
        }),
      });
      const payData = await payRes.json();
      if (!payData.success)
        return alert(payData.error || "❌ Erreur lors du lancement du job");

      alert("✅ Job lancé, le serveur privé sera créé sous peu !");

      // 3️⃣ Polling du job toutes les 3 secondes
      const job_id = payData.job_id;

      const pollJob = setInterval(async () => {
        const statusRes = await fetch(`${API_BASE_URL}/api/jobStatus`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ job_id }),
        });
        const statusData = await statusRes.json();

        if (statusData.status === "success") {
          alert("🎉 Serveur privé créé avec succès !");
          clearInterval(pollJob);
          addTransaction(amount);
          btn.disabled = false;
        } else if (statusData.status === "error") {
          alert(
            `❌ Erreur lors de la création du serveur : ${statusData.error}`,
          );
          clearInterval(pollJob);
          btn.disabled = false;
        }
      }, 3000);
    } catch (err) {
      console.error(err);
      alert("Erreur inattendue");
      btn.disabled = false; // ← et en cas d'erreur avant le polling
    }
  });
  async function checkAndFixRobloxName(user) {
    if (!user) return;

    const uid = user.uid;
    const snapshot = await firebase
      .database()
      .ref(`users/${uid}/RobloxName`)
      .get();
    const robloxName = snapshot.val();

    // Vérifier via backend
    const res = await fetch(`${API_BASE_URL}/api/roblox-user/${robloxName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [robloxName],
        excludeBannedUsers: true,
      }),
    });
    const data = await res.json();

    if (!data?.data?.length) {
      // Pseudo invalide → afficher modal
      showRobloxWarning(
        "Le pseudo entré lors de votre inscription sur notre site est invalide ! Merci de bien vouloir mettre un pseudo Roblox valide pour poursuivre vos fonctions sur notre site.",
        async (newName, overlay) => {
          // Vérifier le nouveau pseudo
          const resCheck = await fetch(
            `${API_BASE_URL}/api/roblox-user/${newName}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                usernames: [newName],
                excludeBannedUsers: true,
              }),
            },
          );
          const dataCheck = await resCheck.json();
          if (!dataCheck?.data?.length)
            return alert("Pseudo invalide, essayez un autre !");

          // Mettre à jour Firebase
          const token = await user.getIdToken();
          await fetch(`${API_BASE_URL}/api/update-roblox-name`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ newName }),
          });
          alert("Pseudo Roblox mis à jour ✅");

          // Fermer le modal
          document.body.removeChild(overlay);
          window.location.reload();
        },
      );
    }
  }

  function showRobloxWarning(message, callback) {
    // Crée le fond modal
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100vw";
    overlay.style.height = "100vh";
    overlay.style.background = "rgba(0,0,0,0.6)";
    overlay.style.display = "flex";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.zIndex = "9999";

    // Crée le conteneur du modal
    const modal = document.createElement("div");
    modal.style.background = "#222";
    modal.style.padding = "20px";
    modal.style.borderRadius = "10px";
    modal.style.width = "300px";
    modal.style.textAlign = "center";
    modal.style.color = "#fff";
    overlay.appendChild(modal);
    // Erreur
    const errorMsg = document.createElement("p");
    errorMsg.style.color = "#ff5555";
    errorMsg.style.fontSize = "0.9rem";
    modal.appendChild(errorMsg);
    // Message
    const msg = document.createElement("p");
    msg.textContent = message;
    modal.appendChild(msg);

    // Input pseudo
    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "Nouveau pseudo Roblox";
    input.style.width = "90%";
    input.style.margin = "10px 0";
    input.style.padding = "8px";
    input.style.borderRadius = "5px";
    input.style.border = "1px solid #555";
    modal.appendChild(input);

    // Boutons container
    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.justifyContent = "space-around";
    modal.appendChild(btnContainer);

    // Bouton Valider
    const validateBtn = document.createElement("button");
    validateBtn.textContent = "Valider";
    validateBtn.style.padding = "8px 12px";
    validateBtn.style.borderRadius = "5px";
    validateBtn.style.border = "none";
    validateBtn.style.cursor = "pointer";
    validateBtn.style.background = "#00ff6a";
    validateBtn.style.color = "#000";
    btnContainer.appendChild(validateBtn);

    document.body.appendChild(overlay);

    // Event Valider
    validateBtn.onclick = async () => {
      const newName = input.value.trim();
      if (!newName) return alert("Veuillez entrer un pseudo Roblox valide !");
      callback(newName, overlay); // renvoie le pseudo au callback pour traitement
    };
  }
});
