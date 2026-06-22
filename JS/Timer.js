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
    const detailsBtn = card.querySelector("[data-details]");
    const joinBtn = card.querySelector(".join-btn");

    joinBtn.onclick = () => {
      navigate("/Pages/Event");
    };

    if (detailsBtn) {
      detailsBtn.addEventListener("click", () => {
        overlay.style.display = "flex";
      });
    }
  });
});
