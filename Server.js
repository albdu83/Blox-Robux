document.addEventListener("DOMContentLoaded", () => {

    const db = firebase.database();

    // ==================== INSCRIPTION ====================
    const formInscription = document.getElementById('form-inscription');
    if (formInscription) {
        formInscription.addEventListener('submit', function(e) {
            e.preventDefault();

            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirmPassword').value;

            if (password !== confirmPassword) {
                alert("Les mots de passe ne correspondent pas !❌");
                return;
            }

            // Vérifier si l'utilisateur existe déjà
            db.ref('users/' + username).get().then(snapshot => {
                if (snapshot.exists()) {
                    alert("Ce pseudo est déjà inscrit !❌");
                } else {
                    // Créer l'utilisateur dans Firebase
                    db.ref('users/' + username).set({
                        password: password,
                        balance: 0
                    }).then(() => {
                        localStorage.setItem('connectedUser', username);
                        window.location.href = "../Page de gain/gagner.html";
                    }).catch(err => console.error(err));
                }
            }).catch(err => console.error(err));
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

    // ==================== AFFICHAGE SOLDE ====================
    const connectedUser = localStorage.getItem('connectedUser');
    if (connectedUser) {
        const balanceEl = document.getElementById('balance');
        if (balanceEl) {
            db.ref('users/' + connectedUser + '/balance').on('value', snapshot => {
                const balance = snapshot.val() || 0;
                balanceEl.textContent = balance + " R$";
            });
        }

        // ==================== AVATAR ROBLOX ====================
        setRobloxAvatar(connectedUser);

        // Modifier boutons si connecté
        const btnInscription = document.getElementById('btn-inscription');
        const btnConnexion = document.getElementById('btn-connexion');
        const lienprofil = document.getElementById('lien-profil');
        const frame = document.getElementById('warn');
        frame.style.display = "none"

        if (btnInscription && btnConnexion && lienprofil) {
            lienprofil.textContent = connectedUser;
            btnInscription.textContent = "Déconnexion";
            btnConnexion.textContent = "Commencer";
            btnConnexion.href = "./Page de gain/gagner.html";
            btnConnexion.href = "./Page de gain/gagner.html"; btnInscription.removeAttribute('href') 
            btnInscription.style.cursor = "pointer";

            btnInscription.addEventListener('click', () => { 
            const frame = document.getElementById('warn')
            frame.style.display = "inline-block" 
        });
        } else { 
        btnInscription.setAttribute('href', "./page de connexion/index2.html"); 
        btnConnexion.setAttribute('href', "./page de connexion/index.html"); 
        } 
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

// ==================== FONCTIONS ROBLOX ====================
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
