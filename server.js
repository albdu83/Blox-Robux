const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/avatar/:username", async (req, res) => {
    const username = req.params.username;

    try {
        // fetch natif Node 24+
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
        });
        console.log("Appel de l'API Roblox pour :", username);
        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            return res.status(404).json({ error: "Utilisateur Roblox introuvable" });
        }

        const userId = data.data[0].id;
        const avatarUrl = `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=100&height=100&format=png`;

        res.json({ avatarUrl });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur lors de la récupération de l'avatar" });
    }
    console.log("Réponse reçue :", data);
});

app.listen(3000, () => console.log("Serveur démarré sur http://localhost:3000"));
