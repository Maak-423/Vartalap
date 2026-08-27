(function () {
  "use strict";

  var stompClient = null;
  var username = null;
  var roomId = null;
  var typingTimeout = null;
  var toastTimeout = null;
  var lastTypingSent = 0;
  var lastSender = null;

  var AVATAR_COLORS = [
    "linear-gradient(135deg,#ff9a3c,#ff5cae)",
    "linear-gradient(135deg,#29d8c4,#4f8cff)",
    "linear-gradient(135deg,#7c5cff,#b25cff)",
    "linear-gradient(135deg,#3ddc97,#29d8c4)",
    "linear-gradient(135deg,#ffd93d,#ff9a3c)",
    "linear-gradient(135deg,#ff5c5c,#ff5cae)"
  ];

  var EMOJIS = ["😀","😄","😁","😂","🤣","😊","😍","😘","😉","😎","🤩","🥳","🤔","🤗","😴","😢",
                "😭","😡","👍","👎","👏","🙏","💪","🔥","✨","🎉","❤️","💔","💯","👀","🙌","🤝",
                "☕","🍕","🎂","🎁","⚡","🌟","🚀","😅","😇","🥰"];

  var joinScreen = document.getElementById("join-screen");
  var chatScreen = document.getElementById("chat-screen");
  var joinBtn = document.getElementById("join-btn");
  var leaveBtn = document.getElementById("leave-btn");
  var copyBtn = document.getElementById("copy-btn");
  var diceBtn = document.getElementById("dice-btn");
  var emojiBtn = document.getElementById("emoji-btn");
  var emojiPicker = document.getElementById("emoji-picker");
  var joinError = document.getElementById("join-error");
  var usernameInput = document.getElementById("username");
  var roomInput = document.getElementById("room");
  var roomTitle = document.getElementById("room-title");
  var roomAvatar = document.getElementById("room-avatar");
  var statusEl = document.getElementById("status");
  var messagesEl = document.getElementById("messages");
  var typingEl = document.getElementById("typing-indicator");
  var chatForm = document.getElementById("chat-form");
  var messageInput = document.getElementById("message-input");
  var toastEl = document.getElementById("toast");

  // Pre-fill room from ?room=xyz so a link can be shared
  var params = new URLSearchParams(window.location.search);
  if (params.get("room")) {
    roomInput.value = params.get("room");
  }

  buildEmojiPicker();

  joinBtn.addEventListener("click", connect);
  roomInput.addEventListener("keyup", function (e) { if (e.key === "Enter") connect(); });
  usernameInput.addEventListener("keyup", function (e) { if (e.key === "Enter") connect(); });
  leaveBtn.addEventListener("click", disconnect);
  copyBtn.addEventListener("click", copyInvite);
  diceBtn.addEventListener("click", randomRoom);
  emojiBtn.addEventListener("click", toggleEmojiPicker);
  chatForm.addEventListener("submit", sendMessage);
  messageInput.addEventListener("input", notifyTyping);

  // Close the emoji picker when clicking elsewhere
  document.addEventListener("click", function (e) {
    if (!emojiPicker.contains(e.target) && e.target !== emojiBtn) {
      emojiPicker.classList.add("hidden");
    }
  });

  function buildEmojiPicker() {
    EMOJIS.forEach(function (emoji) {
      var span = document.createElement("span");
      span.textContent = emoji;
      span.addEventListener("click", function () {
        messageInput.value += emoji;
        messageInput.focus();
      });
      emojiPicker.appendChild(span);
    });
  }

  function toggleEmojiPicker() {
    emojiPicker.classList.toggle("hidden");
  }

  function randomRoom() {
    var words = ["sunny", "cosmic", "mango", "tiger", "river", "pixel", "cloud", "amber"];
    var word = words[Math.floor(Math.random() * words.length)];
    roomInput.value = word + "-" + Math.floor(100 + Math.random() * 900);
    roomInput.focus();
  }

  var BACKEND = (window.BACKEND_URL || "").replace(/\/$/, "");

  function copyInvite() {
    var link = window.location.origin + window.location.pathname + "?room=" + encodeURIComponent(roomId);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).then(function () {
        showToast("Invite link copied! 🔗");
      }, function () {
        showToast("Room code: " + roomId);
      });
    } else {
      showToast("Room code: " + roomId);
    }
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(function () { toastEl.classList.remove("show"); }, 2600);
  }

  function connect() {
    username = usernameInput.value.trim();
    roomId = roomInput.value.trim();

    if (!username || !roomId) {
      joinError.textContent = "Please enter both your name and a room code.";
      return;
    }

    if (window.location.protocol === "file:") {
      joinError.textContent = "Open http://localhost:8080 instead of the file — the server must be running.";
      return;
    }

    if (typeof SockJS === "undefined" || typeof Stomp === "undefined") {
      joinError.textContent = "Chat libraries failed to load. Check your internet connection.";
      return;
    }

    joinError.textContent = "";

    var socket = new SockJS(BACKEND + "/ws");
    stompClient = Stomp.over(socket);
    stompClient.debug = null;

    stompClient.connect({}, onConnected, onError);
  }

  function onConnected() {
    joinScreen.classList.add("hidden");
    chatScreen.classList.remove("hidden");
    roomTitle.textContent = roomId;
    roomAvatar.textContent = roomId.charAt(0).toUpperCase();
    setStatus(true);
    lastSender = null;

    stompClient.subscribe("/topic/room/" + roomId, onMessageReceived);

    stompClient.send("/app/chat/" + roomId + "/join", {}, JSON.stringify({
      sender: username,
      type: "JOIN"
    }));

    messageInput.focus();
  }

  function onError() {
    joinError.textContent = "Could not connect to the server. Is it running?";
    setStatus(false);
  }

  function disconnect() {
    if (stompClient) {
      stompClient.disconnect();
      stompClient = null;
    }
    setStatus(false);
    messagesEl.innerHTML = "";
    typingEl.textContent = "";
    emojiPicker.classList.add("hidden");
    chatScreen.classList.add("hidden");
    joinScreen.classList.remove("hidden");
  }

  function sendMessage(e) {
    e.preventDefault();
    var text = messageInput.value.trim();
    if (!text || !stompClient) return;

    stompClient.send("/app/chat/" + roomId + "/send", {}, JSON.stringify({
      sender: username,
      content: text,
      type: "CHAT"
    }));

    messageInput.value = "";
    emojiPicker.classList.add("hidden");
    messageInput.focus();
  }

  function notifyTyping() {
    if (!stompClient) return;
    var now = Date.now();
    if (now - lastTypingSent < 1200) return; // throttle
    lastTypingSent = now;

    stompClient.send("/app/chat/" + roomId + "/typing", {}, JSON.stringify({
      sender: username,
      type: "TYPING"
    }));
  }

  function onMessageReceived(payload) {
    var msg = JSON.parse(payload.body);

    if (msg.type === "TYPING") {
      if (msg.sender !== username) showTyping(msg.sender);
      return;
    }

    if (msg.type === "JOIN" || msg.type === "LEAVE") {
      appendSystem((msg.type === "JOIN" ? "👋 " : "🚪 ") + msg.content);
      lastSender = null;
      return;
    }

    appendMessage(msg);
  }

  function showTyping(who) {
    typingEl.textContent = who + " is typing…";
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(function () { typingEl.textContent = ""; }, 2000);
  }

  function colorFor(name) {
    var hash = 0;
    for (var i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  }

  function appendMessage(msg) {
    var mine = msg.sender === username;

    var row = document.createElement("div");
    row.className = "row " + (mine ? "me" : "them");

    // Avatar (hidden when the same person sends consecutive messages)
    var avatar = document.createElement("div");
    avatar.className = "avatar";
    if (lastSender === msg.sender) {
      avatar.style.visibility = "hidden";
    } else {
      avatar.textContent = msg.sender.charAt(0).toUpperCase();
      avatar.style.background = colorFor(msg.sender);
    }
    row.appendChild(avatar);

    var bubble = document.createElement("div");
    bubble.className = "msg";

    if (!mine && lastSender !== msg.sender) {
      var name = document.createElement("span");
      name.className = "name";
      name.textContent = msg.sender;
      bubble.appendChild(name);
    }

    var body = document.createElement("span");
    body.textContent = msg.content;
    bubble.appendChild(body);

    var meta = document.createElement("span");
    meta.className = "meta";
    meta.textContent = formatTime(msg.timestamp);
    bubble.appendChild(meta);

    row.appendChild(bubble);
    messagesEl.appendChild(row);

    lastSender = msg.sender;
    typingEl.textContent = "";
    scrollToBottom();
  }

  function appendSystem(text) {
    var el = document.createElement("div");
    el.className = "system";
    el.textContent = text;
    messagesEl.appendChild(el);
    scrollToBottom();
  }

  function formatTime(ts) {
    var d = ts ? new Date(ts) : new Date();
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function setStatus(online) {
    statusEl.innerHTML = '<i class="dot"></i>' + (online ? "connected" : "disconnected");
    statusEl.className = "status " + (online ? "online" : "offline");
  }

  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
})();
