const transition = document.getElementById("transition");
const slideDuration = 500; // correspond au CSS

document.addEventListener("DOMContentLoaded", () => {
    if (!transition) return;

    // --- Descend le rideau au chargement ---
    transition.classList.add("active"); // rideau visible
    setTimeout(() => {
        transition.classList.add("slide-down"); // descend le rideau
        transition.style.pointerEvents = "none"; // page utilisable
    }, 50);

    // --- Navigation interne ---
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
