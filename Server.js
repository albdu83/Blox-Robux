const transition = document.getElementById("transition");
const slideDuration = 750;
const text = document.getElementById("text-chargement");

document.addEventListener("DOMContentLoaded", () => {
    if (!transition) return;

    // Rideau descend après chargement
    transition.classList.add("active");
    setTimeout(() => {
        transition.classList.add("slide-down");
        transition.style.pointerEvents = "none";
    }, 50);

    // Animation texte "Chargement..."
    const steps = ["Chargement", "Chargement.", "Chargement..", "Chargement..."];
    let step = 0;
    function loop() {
        text.textContent = steps[step];
        step = (step + 1) % steps.length;
        setTimeout(loop, 500);
    }
    loop();

    // Navigation interne
    document.body.addEventListener("click", (e) => {
        const link = e.target.closest("a[href]");
        if (!link) return;

        const url = link.getAttribute("href");
        if (url.startsWith("#") || (url.startsWith("http") && !url.includes(window.location.hostname))) return;

        e.preventDefault();
        transition.style.pointerEvents = "all";
        transition.classList.remove("slide-down");
        transition.classList.add("active");

        setTimeout(() => {
            window.location.href = url;
        }, slideDuration);
    });
});
















