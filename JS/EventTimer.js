/* Compte à rebours Halloween réutilisable sur Offres et sur la page Event. */
document.addEventListener("DOMContentLoaded", () => {
  const API = typeof API_BASE_URL === "string" ? API_BASE_URL : (window.API_BASE_URL || "");
  const offersPage = document.getElementById("body");
  const mount = offersPage
    ? (document.querySelector("#app-desktop .page-wrap") || offersPage)
    : document.querySelector("#event .event-intro");
  if (!mount) return;

  const panel = document.createElement("section");
  panel.className = "halloween-countdown";
  panel.setAttribute("aria-live", "polite");
  panel.innerHTML = [
    '<div class="halloween-countdown__copy">',
    '<span class="halloween-countdown__eyebrow">🎃 Événement spécial</span>',
    '<strong class="halloween-countdown__title">Halloween approche…</strong>',
    '<span class="halloween-countdown__caption">Ouverture dans</span>',
    '</div>',
    '<time class="halloween-countdown__clock" aria-label="Temps restant">--:--</time>',
    '<a class="halloween-countdown__link" hidden>Entrer dans l’événement</a>',
  ].join("");

  const style = document.createElement("style");
  style.textContent = `
    .halloween-countdown{display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:14px 24px;margin:20px auto;padding:18px 22px;width:min(900px,calc(100% - 28px));border:1px solid rgba(167,139,250,.42);border-radius:20px;color:#f7f4ff;background:radial-gradient(ellipse at 12% 0%,rgba(139,92,246,.25),transparent 55%),linear-gradient(135deg,#11152d,#211638 58%,#11152d);box-shadow:0 14px 40px rgba(7,8,24,.35),inset 0 1px rgba(255,255,255,.08);font-family:inherit}
    .halloween-countdown__copy{display:grid;gap:2px;text-align:left}
    .halloween-countdown__eyebrow{color:#c4b5fd;font-size:.76rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
    .halloween-countdown__title{font-size:1.08rem;color:#fff}
    .halloween-countdown__caption{color:#bdc5df;font-size:.88rem}
    .halloween-countdown__clock{min-width:142px;padding:7px 16px;border:1px solid rgba(251,191,36,.3);border-radius:14px;color:#ffd18a;background:rgba(7,10,27,.56);font:800 clamp(2rem,5vw,2.8rem)/1.15 ui-monospace,SFMono-Regular,Consolas,monospace;text-align:center;font-variant-numeric:tabular-nums;letter-spacing:.04em}
    .halloween-countdown__link{padding:11px 15px;border-radius:12px;color:#17152c;background:linear-gradient(120deg,#ffd18a,#f3ad58);font-weight:800;text-decoration:none;transition:transform .2s,filter .2s}
    .halloween-countdown__link:hover{transform:translateY(-2px);filter:brightness(1.06)}
    .halloween-countdown[hidden],.halloween-countdown__link[hidden]{display:none}
    @media(max-width:560px){.halloween-countdown{gap:12px;padding:16px;text-align:center}.halloween-countdown__copy{width:100%;text-align:center}.halloween-countdown__clock{min-width:132px}.halloween-countdown__link{width:100%;text-align:center}}
    @media(prefers-reduced-motion:reduce){.halloween-countdown__link{transition:none}}
  `;
  document.head.append(style);

  if (offersPage) mount.insertBefore(panel, mount.firstChild);
  else mount.append(panel);

  const title = panel.querySelector(".halloween-countdown__title");
  const caption = panel.querySelector(".halloween-countdown__caption");
  const clock = panel.querySelector(".halloween-countdown__clock");
  const link = panel.querySelector(".halloween-countdown__link");
  let startAt = 0;
  let serverOffset = 0;
  let opened = false;

  function render() {
    if (opened || !startAt) return;
    const leftMs = Math.max(0, startAt - (Date.now() + serverOffset));
    const totalSeconds = Math.ceil(leftMs / 1000);
    // Minutes totales (pas d'heures) pour conserver le format MM:SS demandé.
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    clock.textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    if (totalSeconds === 0) caption.textContent = "Vérification de l’ouverture…";
  }

  async function refresh() {
    try {
      const response = await fetch(API + "/api/halloween/status", { cache: "no-store" });
      if (!response.ok) throw new Error("Statut indisponible");
      const data = await response.json();
      serverOffset = Number(data.serverNow) - Date.now();
      startAt = Number(data.startsAt);

      if (data.active && typeof data.eventUrl === "string") {
        opened = true;
        title.textContent = "L’événement Halloween est ouvert !";
        caption.textContent = "Bienvenue dans l’événement";
        clock.textContent = "C’EST PARTI";
        link.href = data.eventUrl;
        link.hidden = false;
      } else if (data.ended) {
        title.textContent = "L’événement Halloween est terminé";
        caption.textContent = "À l’année prochaine !";
        clock.textContent = "🎃";
      } else {
        render();
      }
    } catch (error) {
      caption.textContent = "Connexion au serveur…";
    }
  }

  refresh();
  window.setInterval(render, 1000);
  window.setInterval(() => { if (!opened) refresh(); }, 15000);
});
