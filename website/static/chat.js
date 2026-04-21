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

  const demoResponses = [
    "I hear you, and I want you to know that your feelings are completely valid. It takes courage to share what you're going through. Can you tell me more about what's been on your mind?",
    "Thank you for opening up. It sounds like you've been carrying a lot. Remember, seeking support is a sign of strength, not weakness. What specific aspects would you like to explore together?",
    "I understand that can be really challenging. Many people experience similar feelings, and it's important to acknowledge them rather than push them away. What coping strategies have you tried so far?",
    "It seems like this has been weighing on you for some time. Let's work through this together. Sometimes breaking down our concerns into smaller parts can make them feel more manageable. Where would you like to start?",
    "I appreciate you sharing that with me. Your emotional well-being matters, and I'm here to support you. Have you noticed any patterns in when these feelings tend to come up?",
    "That sounds like a lot of pressure to carry. It's completely normal to feel overwhelmed when facing uncertainty about your future. One helpful approach is to focus on what you can control right now, rather than trying to predict every outcome. What feels most urgent to you at this moment?",
    "I can sense how important this is to you, and your concern shows that you care deeply about making good choices. Anxiety about the future often comes from wanting things to go well. Let's explore what a 'right choice' looks like for you — sometimes redefining success can ease a lot of that pressure.",
  ];

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
        modelBadge.style.opacity = "1";
      } else {
        modelBadge.textContent = "Demo mode (no model worker)";
        modelBadge.style.opacity = "0.85";
        modelBadge.style.display = "inline";
      }
    } catch {
      modelBadge.textContent = "API unavailable";
      modelBadge.style.opacity = "0.5";
    }
  }

  function typeOutDemo(botDiv, reply) {
    return new Promise((resolve) => {
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

  async function runDemoFallback() {
    removeTyping();
    const reply =
      demoResponses[Math.floor(Math.random() * demoResponses.length)];
    const botDiv = addMessage("bot", "");
    await typeOutDemo(botDiv, reply);
  }

  /**
   * Read SSE from FastChat proxy; returns full assistant text or null if stream errored.
   */
  async function readChatStream(response) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const block of parts) {
        const lines = block.split("\n");
        let dataPayload = "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            dataPayload += line.slice(6);
          }
        }
        const trimmed = dataPayload.trim();
        if (!trimmed || trimmed === "[DONE]") continue;

        let obj;
        try {
          obj = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (obj.error_code != null && obj.error_code !== 0) {
          return null;
        }
        if (obj.error != null || obj.status != null) {
          return null;
        }

        const choices = obj.choices;
        if (!choices || !choices.length) continue;

        const delta = choices[0].delta;
        if (delta && typeof delta.content === "string") {
          fullText += delta.content;
        }
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const trimmed = line.slice(6).trim();
        if (trimmed === "[DONE]") continue;
        try {
          const obj = JSON.parse(trimmed);
          if (obj.error_code != null && obj.error_code !== 0) return null;
          const choices = obj.choices;
          if (choices && choices[0].delta && typeof choices[0].delta.content === "string") {
            fullText += choices[0].delta.content;
          }
        } catch {
          /* ignore */
        }
      }
    }

    return fullText;
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

    let usedDemo = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, model: currentModel }),
      });

      const ct = res.headers.get("content-type") || "";

      if (!res.ok && ct.includes("application/json")) {
        removeTyping();
        usedDemo = true;
      } else if (res.ok && ct.includes("text/event-stream")) {
        removeTyping();
        const botDiv = addMessage("bot", "");
        const streamed = await readChatStream(res);
        if (streamed == null || streamed === "") {
          botDiv.remove();
          usedDemo = true;
        } else {
          botDiv.textContent = streamed;
          messagesEl.scrollTop = messagesEl.scrollHeight;
          history.push({ role: "assistant", content: streamed });
        }
      } else {
        removeTyping();
        usedDemo = true;
      }
    } catch {
      removeTyping();
      usedDemo = true;
    }

    if (usedDemo) {
      await runDemoFallback();
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
