const transition = document.getElementById("transition");
const slideDuration = 750;
const text = document.getElementById("text-chargement");
const img = document.getElementById("image")

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
    function animateText() {
        text.textContent = steps[step];
        step = (step + 1) % steps.length;
        requestAnimationFrame(() => setTimeout(animateText, 400));
    }
    animateText();

    let lastTime = 0;
    let angle = 0;

    function animateLogo(time) {
        if (lastTime !== 0) {
            const delta = (time - lastTime) / 1000;
            angle += 360 * delta; // rotation 360°/s
            img.style.transform = `rotate(${angle}deg) scale(${1 + 0.05 * Math.sin(angle * Math.PI/180)})`;
        }
        lastTime = time;
        requestAnimationFrame(animateLogo);
    }

    requestAnimationFrame(animateLogo);

    function waitForResources(callback) {
        const iframes = ["timewall-container", "theoremecontainer", "offerwall1"];
        let loaded = 0;

        iframes.forEach(id => {
            const iframe = document.getElementById(id);
            if (iframe) {
                iframe.addEventListener("load", () => {
                    loaded++;
                    if (loaded === iframes.length) callback();
                    });
                } else {
                loaded++;
            }
        });

        // Timeout pour sécurité (ex: 10 s)
        setTimeout(() => callback(), 10000);
    }

    waitForResources(() => {
        transition.classList.add("slide-up");
    });

    // Navigation interne
    document.body.addEventListener("click", (e) => {
        const link = e.target.closest("a[href]");
        if (!link) return;

        const url = link.getAttribute("href");
        const target = link.getAttribute("target");
        if (target === "_blank") return;
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
