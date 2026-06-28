document.addEventListener("DOMContentLoaded", () => {
  /* =========================
     ELEMENTS
  ========================= */
  const tabs = document.querySelectorAll(".tab-btn");
  const panels = document.querySelectorAll(".tab-panel");
  const header = document.querySelector("header");

  const loadingWrapper = document.getElementById("sous-container-wrapper");

  const boostBanner = document.getElementById("boost-banner");
  const boostPercentEl = document.getElementById("boost-percent");
  const boostClose = document.getElementById("boostclose");

  /* =========================
     LOADING (safe)
  ========================= */
  if (loadingWrapper) {
    loadingWrapper.style.display = "flex";

    window.addEventListener("load", () => {
      setTimeout(() => {
        loadingWrapper.style.display = "none";
      }, 300);
    });
  }

  /* =========================
     TAB SYSTEM (CLEAN & SCALABLE)
  ========================= */
  function activateTab(tabName) {
    tabs.forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.tab === tabName);
    });

    panels.forEach((panel) => {
      panel.classList.toggle("active", panel.dataset.panel === tabName);
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
    });
  });

  // Default tab (safe)
  if (tabs.length > 0) {
    activateTab(tabs[0].dataset.tab);
  }

  /* =========================
     ELEMENTS (ajoute ces 2 lignes à tes variables existantes)
  ========================= */
  const offerwallMain = document.querySelector(".offerwall-page-main");
  const offerwallBackBtn = document.getElementById("offerwallBackBtn");
  let offerwallModeEntered = false;

  function removeTabActive() {
    tabs.forEach((tab) => {
      tab.classList.remove("active");
    });
  }

  if (!offerwallModeEntered) {
    removeTabActive();
  }

  /* =========================
     MODE IMMERSIF MUR D'OFFRES
  ========================= */
  function enterOfferwallMode() {
    offerwallMain.style.display = "block";
    offerwallBackBtn.style.display = "inline-block";
    document.body.classList.toggle("offerwall-mode");
    setTimeout(() => {
      offerwallMain.classList.toggle("active");
      offerwallBackBtn.classList.toggle("active");
    }, 500);
    offerwallModeEntered = true;
    setTimeout(() => {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    }, 700);
  }

  function exitOfferwallMode() {
    offerwallMain.classList.remove("active");
    offerwallBackBtn.classList.remove("active");
    setTimeout(() => {
      offerwallBackBtn.style.display = "none";
      offerwallMain.style.display = "none";
      document.body.classList.remove("offerwall-mode");
    }, 100);
    offerwallModeEntered = false;
  }

  if (offerwallBackBtn) {
    offerwallBackBtn.addEventListener("click", () => {
      exitOfferwallMode();
      removeTabActive();
    });
  }

  /* =========================
     TAB SYSTEM (remplace ton addEventListener existant sur tabs)
  ========================= */
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
      if (!offerwallModeEntered) {
        enterOfferwallMode();
      }
    });
  });

  /* =========================
     SCROLL HEADER EFFECT
  ========================= */
  if (header) {
    window.addEventListener("scroll", () => {
      header.classList.toggle("scrolled", window.scrollY > 50);
    });
  }

  /* =========================
     BOOST BANNER
  ========================= */
  async function loadBoost() {
    if (!boostBanner || !boostPercentEl) return;

    try {
      const res = await fetch(`${API_BASE_URL}/getmultiplier`);
      const data = await res.json();

      const multiplier = data?.multiplier ?? 1;

      if (multiplier > 1) {
        const percent = Math.round((multiplier - 1) * 100);
        boostPercentEl.textContent = percent;
        boostBanner.style.display = "flex";
      } else {
        boostBanner.style.display = "none";
      }
    } catch (err) {
      console.error("Boost error:", err);
      boostBanner.style.display = "none";
    }
  }

  loadBoost();

  if (boostClose) {
    boostClose.addEventListener("click", () => {
      boostBanner.style.display = "none";
    });
  }

  /* =========================
     MOBILE NAV CLEAN FIX
  ========================= */
  const barres = document.getElementById("barres");
  const navBtns = document.getElementById("btns");
  const soldeBox = document.getElementById("solde-box");

  function handleResponsive() {
    if (!barres || !navBtns || !soldeBox) return;

    if (window.innerWidth >= 1024) {
      barres.style.display = "none";
      navBtns.style.display = "flex";
      soldeBox.style.display = "flex";
    } else {
      barres.style.display = "block";
      navBtns.style.display = "none";
      soldeBox.style.display = "none";
    }
  }

  handleResponsive();
  window.addEventListener("resize", handleResponsive);
});
