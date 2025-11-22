document.addEventListener("DOMContentLoaded", () => {
    const db = firebase.database();
    const connectedUser = localStorage.getItem('connectedUser');

    // ==================== INSCRIPTION ====================
    const formInscription = document.getElementById('form-inscription');
    if (formInscription) {
        formInscription.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const RobloxName = document.getElementById('RobloxName').value.trim();

            if (password !== confirmPassword) {
                alert("Les mots de passe ne correspondent pas !❌");
                return;
            }

            db.ref('users/' + username).get().then(snapshot => {
                if (snapshot.exists()) {
                    alert("Ce pseudo est déjà inscrit !❌");
                } else {
                    db.ref('users/' + username).set({
                        password,
                        RobloxName,
                        balance: 0
                    })
                    .then(() => {
                        localStorage.setItem('connectedUser', username);
                        window.location.href = "../Page de gain/gagner.html";
                    })
                    .catch(err => console.error(err));
                }
            });
        });
    }

    // ==================== CONNEXION ====================
    const formConnexion = document.getElementById('form-connexion');
    if (formConnexion) {
        formConnexion.addEventListener('submit', function(e) {
            e.preventDefault();
            const username = document.getElementById('loginUsername').value.trim();
            const password = document.getElementById('loginPassword').value;

            db.ref('users/' + username).get().then(snapshot => {
                if (snapshot.exists() && snapshot.val().password === password) {
                    localStorage.setItem('connectedUser', username);
                    alert(`Connexion réussie ✅! Bienvenue ${username}`);
                    window.location.href = "../Page de gain/gagner.html";
                } else {
                    alert("Nom d'utilisateur ou mot de passe incorrect !❌");
                }
            }).catch(err => console.error(err));
        });
    }

    // ==================== GESTION PROFIL + AVATAR + TIMEWALL ====================
    if (connectedUser) {
        db.ref('users/' + connectedUser).get().then(snapshot => {
            if (!snapshot.exists()) return;

            const robloxName = snapshot.val().RobloxName;

            // Mettre le nom Roblox
            const lienprofil = document.getElementById('lien-profil');
            if (lienprofil) {
                const spanNom = lienprofil.querySelector("span");
                if (spanNom) spanNom.textContent = `${connectedUser} / ${robloxName}`;
            }

            // Avatar Roblox
            setRobloxAvatar(robloxName);

            // === TIMEWALL ===
            const container = document.getElementById("timewall-container");

            if (container) {
                const iframe = document.createElement("iframe");
                iframe.title = "TimeWall";
                iframe.src = `https://timewall.io/users/login?oid=2578908b35321055&uid=${robloxName}`;
                iframe.frameBorder = "0";
                iframe.width = "100%";
                iframe.height = "1000";
                iframe.scrolling = "auto";

                container.appendChild(iframe);
            }

            // Boutons connexion/déco
            const btnInscription = document.getElementById('btn-inscription');
            const btnConnexion = document.getElementById('btn-connexion');
            const frame = document.getElementById('warn');

            if (frame) frame.style.display = "none";

            if (btnInscription && btnConnexion) {
                btnInscription.textContent = "Déconnexion";
                btnConnexion.textContent = "Commencer";
                btnConnexion.href = "./Page de gain/gagner.html";
                btnInscription.removeAttribute('href');
                btnInscription.style.cursor = "pointer";
                btnInscription.addEventListener('click', () => {
                    if (frame) frame.style.display = "inline-block";
                });
            }

        });
    }

    // ==================== TOGGLE MOT DE PASSE ====================
    function togglePassword(checkboxId, inputId) {
        const checkbox = document.getElementById(checkboxId);
        const input = document.getElementById(inputId);
        if (checkbox && input) {
            checkbox.addEventListener("change", () => {
                input.type = checkbox.checked ? "text" : "password";
            });
        }
    }
    togglePassword("showPassword", "loginPassword");
    togglePassword("showPassword2", "password");
    togglePassword("showPassword3", "confirmPassword");
});

// ==================== FONCTION AVATAR ROBLOX ====================
const API_BASE_URL = location.hostname === "localhost" 
    ? "http://localhost:3000"
    : "https://blox-robux.onrender.com";

async function setRobloxAvatar(robloxName) {
    try {
        const res = await fetch(`${API_BASE_URL}/api/avatar/${robloxName}`);
        const data = await res.json();

        const avatarImg = document.getElementById("avatar-roblox");
        if (!avatarImg) return;

        avatarImg.src = data.avatarUrl || "img/default-avatar.png";
        avatarImg.style.display = "inline-block";

    } catch (err) {
        console.error("Erreur avatar Roblox :", err);
        const avatarImg = document.getElementById("avatar-roblox");
        if (avatarImg) avatarImg.src = "img/default-avatar.png";
    }
}



// ==================== GET USER ID ROBLOX ====================
async function getRobloxUserId(username) {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
    });
    const data = await response.json();

    if (data.data && data.data.length > 0) {
        return data.data[0].id;
    } else {
        throw new Error("Utilisateur Roblox introuvable");
    }
}



