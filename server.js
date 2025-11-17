const express = require("express");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/avatar/:username", async (req, res) => {
    const username = req.params.username;

    try {
        // 1. Récupérer ID Roblox
        const response = await fetch("https://users.roblox.com/v1/usernames/users", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
        });

        const data = await response.json();
        if (!data.data || data.data.length === 0) {
            return res.status(404).json({ error: "Utilisateur introuvable" });
        }

        const userId = data.data[0].id;

        // 2. Thumbnail Roblox API (pas de CORB)
        const avatarRes = await fetch(
            `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );

        const avatarData = await avatarRes.json();

        if (!avatarData.data || avatarData.data.length === 0) {
            return res.status(500).json({ error: "Erreur avatar Roblox" });
        }

        const avatarUrl = avatarData.data[0].imageUrl;
        res.json({ avatarUrl });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Erreur serveur" });
    }
});

app.listen(3000, () => console.log("API Roblox démarrée sur port 3000"));
