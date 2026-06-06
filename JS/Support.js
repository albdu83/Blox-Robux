document.addEventListener("DOMContentLoaded", async () => {
  await initFirebase();
  async function sendSupportTicket() {
    const user = firebase.auth().currentUser;
    const feedback = document.getElementById("supportFeedback");

    if (!user) {
      feedback.textContent = "Connecte-toi avant de contacter le support.";
      feedback.className = "form-note error";
      return;
    }

    const type = document.getElementById("supportType")?.value;
    const rawMessage = document.getElementById("supportMessage")?.value || "";
    const message = rawMessage.trim() ? rawMessage.slice(0, 2000) : "";

    if (!type || !message) {
      feedback.textContent = "Remplis le sujet et ton message.";
      feedback.className = "form-note error";
      return;
    }

    try {
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/api/support/tickets`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          message,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erreur lors de l'envoi du ticket.");
      }

      await loadMySupportTickets();

      feedback.textContent = `Ticket envoyé !`;
      feedback.className = "form-note success";
      document.getElementById("supportMessage").value = "";
    } catch (err) {
      feedback.textContent =
        err.message || "Erreur serveur, réessaie plus tard.";
      feedback.className = "form-note error";
    }
  }

  async function replyToTicket(ticketId) {
    const user = firebase.auth().currentUser;
    const textarea = document.getElementById(`reply-${ticketId}`);
    const rawMessage2 = textarea?.value || "";
    const message = rawMessage2.trim() ? rawMessage2.slice(0, 2000) : "";

    if (!user || !message) return;

    const token = await user.getIdToken();

    const res = await fetch(
      `${API_BASE_URL}/support/tickets/${ticketId}/reply`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      },
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Impossible d'envoyer la réponse.");
      return;
    }

    textarea.value = "";
    await loadMySupportTickets();
  }

  async function loadMySupportTickets() {
    const user = firebase.auth().currentUser;
    const container = document.getElementById("myTickets");

    if (!container) return;

    if (!user) {
      container.innerHTML = `<p class="form-note error">Connecte-toi pour voir tes tickets.</p>`;
      return;
    }

    try {
      const token = await user.getIdToken();

      const res = await fetch(`${API_BASE_URL}/support/tickets`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Impossible de charger tes tickets.");
      }

      if (!data.tickets?.length) {
        container.innerHTML = `<p class="form-note">Tu n'as aucun ticket pour le moment.</p>`;
        return;
      }

      container.innerHTML = data.tickets
        .map((ticket) => {
          const replies = Object.values(ticket.replies || {});
          const date = new Date(ticket.createdAt).toLocaleString("fr-FR");

          return `
  <div class="user-ticket">
    <div class="user-ticket-head">
      <div>
        <strong>${escapeHTML(ticket.type)}</strong>
        <small>${date}</small>
      </div>
      <span class="ticket-status ${ticket.status}">
        ${formatStatus(ticket.status)}
      </span>
    </div>

    <p class="ticket-message-text">${escapeHTML(ticket.message)}</p>

    <div class="ticket-replies">
      ${
        replies.length
          ? replies
              .map(
                (reply) => `
                  <div class="ticket-reply">
                    <strong>${reply.authorRole === "admin" ? "Support" : "Moi"}</strong>
                    <p class="ticket-message-text">${escapeHTML(reply.message)}</p>
                  </div>
                `,
              )
              .join("")
          : `<p class="form-note">Aucune réponse pour le moment.</p>`
      }
    </div>

    ${
      ticket.status !== "closed"
        ? `
          <div class="user-reply-box">
            <textarea id="reply-${ticket.id}" placeholder="Répondre au support..."></textarea>
            <button type="button" data-reply-ticket="${ticket.id}">Répondre</button>
          </div>
        `
        : `<p class="form-note">Ce ticket est fermé.</p>`
    }
  </div>
`;
        })
        .join("");
    } catch (err) {
      container.innerHTML = `<p class="form-note error">${escapeHTML(err.message)}</p>`;
    }
  }

  document.addEventListener("click", (e) => {
    const button = e.target.closest("[data-reply-ticket]");
    if (!button) return;

    replyToTicket(button.dataset.replyTicket);
  });

  function formatStatus(status) {
    if (status === "open") return "Ouvert";
    if (status === "pending") return "Répondu";
    if (status === "closed") return "Fermé";
    return status;
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  firebase.auth().onAuthStateChanged(() => {
    loadMySupportTickets();
  });

  document
    .getElementById("refreshTickets")
    ?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;

      btn.classList.remove("refresh-spin");
      void btn.offsetWidth;
      btn.classList.add("refresh-spin");

      try {
        await loadMySupportTickets();
      } finally {
        setTimeout(() => {
          btn.classList.remove("refresh-spin");
        }, 600);
      }
    });

  document
    .getElementById("sendSupport")
    ?.addEventListener("click", sendSupportTicket);
});
