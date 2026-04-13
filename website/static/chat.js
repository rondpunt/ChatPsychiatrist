(() => {
  const messagesEl = document.getElementById("chat-messages");
  const inputEl = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send");
  const statusDot = document.getElementById("status-dot");
  const statusText = document.getElementById("status-text");
  const modelBadge = document.getElementById("model-badge");

  let history = [];
  let sending = false;
  let currentModel = "";

  const SYSTEM_PROMPT =
    "You are ChatPsychiatrist, a compassionate and professional AI mental health support assistant. " +
    "You provide empathetic, evidence-based responses using counseling skills such as active listening, " +
    "restatement, reflection, approval, reassurance, and direct guidance. Always be warm, non-judgmental, " +
    "and encouraging. If someone is in crisis, gently recommend professional help.";

  function addMessage(role, content) {
    const div = document.createElement("div");
    div.className = `msg msg-${role}`;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function addSystemMsg(content) {
    const div = document.createElement("div");
    div.className = "msg msg-system";
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showTyping() {
    const div = document.createElement("div");
    div.className = "msg msg-bot";
    div.id = "typing";
    div.innerHTML =
      '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function removeTyping() {
    const el = document.getElementById("typing");
    if (el) el.remove();
  }

  async function checkHealth() {
    try {
      const res = await fetch("/api/health");
      const data = await res.json();
      const allOk = Object.values(data.services).every(
        (s) => s.status === "ok",
      );
      statusDot.className = allOk ? "dot" : "dot offline";
      statusText.textContent = allOk ? "Services online" : "Partial";
    } catch {
      statusDot.className = "dot offline";
      statusText.textContent = "Offline";
    }
  }

  async function loadModels() {
    try {
      const res = await fetch("/api/models");
      const data = await res.json();
      if (data.data && data.data.length > 0) {
        currentModel = data.data[0].id;
        modelBadge.textContent = currentModel;
        modelBadge.style.display = "inline";
      } else {
        modelBadge.textContent = "No model loaded";
        modelBadge.style.opacity = "0.5";
        modelBadge.style.display = "inline";
      }
    } catch {
      modelBadge.textContent = "API unavailable";
      modelBadge.style.opacity = "0.5";
    }
  }

  async function sendMessage() {
    const text = inputEl.value.trim();
    if (!text || sending) return;

    sending = true;
    sendBtn.disabled = true;
    inputEl.value = "";

    addMessage("user", text);
    history.push({ role: "user", content: text });

    const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...history];

    showTyping();

    const demoResponses = [
      "I hear you, and I want you to know that your feelings are completely valid. It takes courage to share what you're going through. Can you tell me more about what's been on your mind?",
      "Thank you for opening up. It sounds like you've been carrying a lot. Remember, seeking support is a sign of strength, not weakness. What specific aspects would you like to explore together?",
      "I understand that can be really challenging. Many people experience similar feelings, and it's important to acknowledge them rather than push them away. What coping strategies have you tried so far?",
      "It seems like this has been weighing on you for some time. Let's work through this together. Sometimes breaking down our concerns into smaller parts can make them feel more manageable. Where would you like to start?",
      "I appreciate you sharing that with me. Your emotional well-being matters, and I'm here to support you. Have you noticed any patterns in when these feelings tend to come up?",
      "That sounds like a lot of pressure to carry. It's completely normal to feel overwhelmed when facing uncertainty about your future. One helpful approach is to focus on what you can control right now, rather than trying to predict every outcome. What feels most urgent to you at this moment?",
      "I can sense how important this is to you, and your concern shows that you care deeply about making good choices. Anxiety about the future often comes from wanting things to go well. Let's explore what a 'right choice' looks like for you — sometimes redefining success can ease a lot of that pressure.",
    ];

    let usedDemo = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model: currentModel }),
      });

      const data = await res.json();

      removeTyping();

      if (data.error) {
        usedDemo = true;
      }
    } catch {
      removeTyping();
      usedDemo = true;
    }

    if (usedDemo) {
      removeTyping();
      const reply =
        demoResponses[Math.floor(Math.random() * demoResponses.length)];

      const botDiv = addMessage("bot", "");
      await new Promise((resolve) => {
        let i = 0;
        const interval = setInterval(() => {
          if (i < reply.length) {
            botDiv.textContent += reply[i];
            i++;
            messagesEl.scrollTop = messagesEl.scrollHeight;
          } else {
            clearInterval(interval);
            history.push({ role: "assistant", content: reply });
            resolve();
          }
        }, 18);
      });
    }

    sending = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  sendBtn.addEventListener("click", sendMessage);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  addSystemMsg(
    "Welcome to ChatPsychiatrist. This is a safe space — share what's on your mind.",
  );

  checkHealth();
  loadModels();
  setInterval(checkHealth, 15000);
})();
