async function getEventEndFromServer() {
  const res = await fetch("https://il.bloxrbx.fr/api/event/info");
  return await res.json();
}

document.addEventListener("DOMContentLoaded", async () => {
  const data = await getEventEndFromServer();
  const eventStart = data.eventStart * 1000;

  const events = document.querySelectorAll("[data-event]");
  const overlay = document.querySelectorAll("#overlay")[0];
  const closeModal = document.querySelectorAll("#closeModal")[0];

  overlay?.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.style.display = "none";
  });

  closeModal?.addEventListener("click", () => {
    overlay.style.display = "none";
  });

  events.forEach((card) => {
    const joinBtn = card.querySelectorAll("[data-join]")[0];
    const hoursEl = card.querySelectorAll("[data-hours]")[0];
    const minutesEl = card.querySelectorAll("[data-minutes]")[0];
    const secondsEl = card.querySelectorAll("[data-seconds]")[0];
    const detailsBtn = card.querySelectorAll("[data-details]")[0];

    let timer;

    joinBtn.disabled = true;
    joinBtn.style.background = "#735b18";

    const updateTimer = () => {
      const remainingTime = Math.floor((eventStart - Date.now()) / 1000);

      if (remainingTime <= 0) {
        clearInterval(timer);

        hoursEl.textContent = "00";
        minutesEl.textContent = "00";
        secondsEl.textContent = "00";

        joinBtn.disabled = false;
        joinBtn.style.background = "#f0c240";

        joinBtn.onclick = () => {
          window.location.href = data.eventUrl;
        };

        return;
      }

      const h = Math.floor(remainingTime / 3600);
      const m = Math.floor((remainingTime % 3600) / 60);
      const s = remainingTime % 60;

      hoursEl.textContent = String(h).padStart(2, "0");
      minutesEl.textContent = String(m).padStart(2, "0");
      secondsEl.textContent = String(s).padStart(2, "0");
    };

    updateTimer();
    timer = setInterval(updateTimer, 1000);

    if (detailsBtn) {
      detailsBtn.addEventListener("click", () => {
        overlay.style.display = "flex";
      });
    }
  });
});
