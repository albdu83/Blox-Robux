document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();
  if (!auth || !db) return console.error("Firebase non initialisé");

  const leaderboardContainer = document.getElementById("leaderboard-body");
  const res = await fetch(API_BASE_URL + "/api/leaderboard");
  const data = await res.json();
  // Afficher le top 3
  [data.top1, data.top2, data.top3].forEach((user, index) => {
    const userElement = document.getElementById(`top${index + 1}`);
    if (userElement) {
      userElement.querySelector(".username").textContent = user.username;
      userElement.querySelector(".robux").textContent =
        `${user.robuxGagnes} R$`;
    }
  });

  data.others.forEach((user, index) => {
    const userElement = document.createElement("tr");
    userElement.classList.add("user");
    userElement.innerHTML = `
      <td><span class="rank">${index + 4}</span></td>
      <td><span class="username">${user.username}</span></td>
      <td><span class="robuxGagnes">${user.robuxGagnes} Robux</span></td>
    `;
    leaderboardContainer.appendChild(userElement);
  });
});
