document.addEventListener("DOMContentLoaded", () => {

    // ==================== INSCRIPTION ====================
    const formInscription = document.getElementById('form-inscription');
if (formInscription) {
    formInscription.addEventListener('submit', function(e) {
        e.preventDefault(); // empêche le refresh

        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if(password !== confirmPassword){
            alert("Les mots de passe ne correspondent pas !❌");
            return;
        }

        // Vérifie si le pseudo est déjà utilisé
        const savedUsername = localStorage.getItem('username');
        if(savedUsername === username){
            alert("Ce pseudo est déjà inscrit !❌");
            return; // on stoppe l'inscription
        }

        // Enregistrement des informations
        localStorage.setItem('username', username);
        localStorage.setItem('password', password);

        // Marquer l'utilisateur comme connecté
        localStorage.setItem('connectedUser', username);

        // Redirection vers la page principale
        window.location.href = "../Page de gain/gagner.html";
    });
}

    // ==================== CONNEXION ====================
    const formConnexion = document.getElementById('form-connexion');
    if (formConnexion) {
        formConnexion.addEventListener('submit', function(e) {
            e.preventDefault(); // empêche le refresh

            const username = document.getElementById('loginUsername').value;
            const password = document.getElementById('loginPassword').value;

            const savedUsername = localStorage.getItem('username');
            const savedPassword = localStorage.getItem('password');
            
            if(username === savedUsername && password === savedPassword){
                localStorage.setItem('connectedUser', username); 
                alert(`Connexion réussie ✅! Bienvenue ${username}`);
                window.location.href = "../Page de gain/gagner.html";
            } else {
                alert("Nom d'utilisateur ou mot de passe incorrect !❌");
            }
        });
    }

    // ==================== PAGE PRINCIPALE ====================
    const btnInscription = document.getElementById('btn-inscription');
    const btnConnexion = document.getElementById('btn-connexion');
    const lienprofil = document.getElementById('lien-profil');
    const frame = document.getElementById('warn');
    frame.style.display = "none"
    if (btnInscription && btnConnexion) {
        const connectedUser = localStorage.getItem('connectedUser');

        if (connectedUser) {
            // Modifier les boutons
            lienprofil.textContent = `${connectedUser}`
            btnInscription.textContent = "Déconnexion";
            btnConnexion.textContent = "Commencer";
            btnConnexion.href = "./Page de gain/gagner.html";
            btnInscription.removeAttribute('href')
            btnInscription.style.cursor = "pointer";
            // Actions
            btnInscription.addEventListener('click', () => {
            const frame = document.getElementById('warn')
            frame.style.display = "inline-block"
            });
        } else {
            btnInscription.onclick = () => window.location.href = "page de connexion/index2.html";
            btnConnexion.onclick = () => window.location.href = "page de connexion/index.html";
        }
    }
});

// Fonction pour récupérer l'ID Roblox à partir du pseudo
async function getRobloxUserId(username) {
    const response = await fetch("https://users.roblox.com/v1/usernames/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            usernames: [username],
            excludeBannedUsers: true
        })
    });

    const data = await response.json();

    if (data.data && data.data.length > 0) {
        return data.data[0].id;
    } else {
        throw new Error("Utilisateur Roblox introuvable");
    }
}

// Fonction pour mettre à jour l’image
async function setRobloxAvatar(username) {
    try {
        const userId = await getRobloxUserId(username);
        const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=100&height=100&format=png`;

        const avatarImg = document.getElementById("avatar-roblox");
        if (avatarImg) {
            avatarImg.src = avatarUrl;
            avatarImg.style.display = "inline-block";
        }
    } catch (err) {
        console.error("Erreur avatar Roblox :", err);
    }
}

// Exécution automatique si un utilisateur est connecté
document.addEventListener("DOMContentLoaded", () => {
    const connectedUser = localStorage.getItem("connectedUser");
    if (connectedUser) {
        setRobloxAvatar(connectedUser);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    // Fonction pour activer/désactiver l'affichage du mot de passe
    function togglePassword(checkboxId, inputId) {
        const checkbox = document.getElementById(checkboxId);
        const input = document.getElementById(inputId);

        if (checkbox && input) {
            checkbox.addEventListener("change", () => {
                input.type = checkbox.checked ? "text" : "password";
            });
        }
    }

    // Appliquer aux différents champs
    togglePassword("showPassword", "loginPassword");       // formulaire connexion
    togglePassword("showPassword2", "password");          // formulaire inscription
    togglePassword("showPassword3", "confirmPassword");   // confirmation mot de passe
});




