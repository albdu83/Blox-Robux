document.addEventListener("DOMContentLoaded", async () => {
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
    joinBtn.onclick = () => {
      window.location.href = "/Event";
    };
  });
});
