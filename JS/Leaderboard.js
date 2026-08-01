document.addEventListener("DOMContentLoaded", async () => {
  const { auth, db } = await initFirebase();
  if (!auth || !db) return console.error("Firebase non initialisé");

  const leaderboardContainer = document.getElementById("leaderboard-body");
  const leaderboardTop3 = document.getElementById("leaderboard-top3");
  const snapshot = await firebase
    .database()
    .ref("users")
    .orderByChild("robuxGagnes")
    .limitToLast(50)
    .once("value");

  const users = [];
  snapshot.forEach((childSnapshot) => {
    const userData = childSnapshot.val();
    users.push({
      username: userData.username,
      robuxGagnes: userData.robuxGagnes,
    });
  });

  users.reverse();
  const top1 = users[0];
  const top2 = users[1];
  const top3 = users[2];
  const others = users.slice(3);
  const offset = top3.length;

  // Afficher le top 3
  [top1, top2, top3].forEach((user, index) => {
    const userElement = document.getElementById(`top${index + 1}`);
    if (userElement) {
      userElement.querySelector(".username").textContent = user.username;
      userElement.querySelector(".robux").textContent =
        `${user.robuxGagnes} R$`;
    }
  });

  others.forEach((user, index) => {
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
