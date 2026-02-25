// ===== CONFIG =====
const SERVER = "https://arcacoin.duckdns.org"

// ===== SESSION =====
const Session = {
  set(token, user, staySignedIn = false) {
    const storage = staySignedIn ? localStorage : sessionStorage
    sessionStorage.removeItem("arc_token")
    sessionStorage.removeItem("arc_user")
    localStorage.removeItem("arc_token")
    localStorage.removeItem("arc_user")
    storage.setItem("arc_token", token)
    storage.setItem("arc_user", JSON.stringify(user))
    if (staySignedIn) localStorage.setItem("arc_stay", "1")
  },
  getToken() {
    return localStorage.getItem("arc_token") || sessionStorage.getItem("arc_token") || null
  },
  getUser() {
    try {
      const raw = localStorage.getItem("arc_user") || sessionStorage.getItem("arc_user")
      return raw ? JSON.parse(raw) : null
    } catch { return null }
  },
  isStaySignedIn() {
    return !!localStorage.getItem("arc_stay")
  },
  clear() {
    sessionStorage.removeItem("arc_token")
    sessionStorage.removeItem("arc_user")
    localStorage.removeItem("arc_token")
    localStorage.removeItem("arc_user")
    localStorage.removeItem("arc_stay")
  },
  isLoggedIn() {
    return !!(localStorage.getItem("arc_token") || sessionStorage.getItem("arc_token"))
  },
  savePrivKey(userId, privKey) {
    localStorage.setItem("arc_privkey_" + userId, privKey)
  },
  getPrivKey(userId) {
    return localStorage.getItem("arc_privkey_" + userId) || null
  },
  deletePrivKey(userId) {
    localStorage.removeItem("arc_privkey_" + userId)
  }
}

// ===== API =====
const API = {
  async _fetch(path, options = {}) {
    const token = Session.getToken()
    const headers = { "Content-Type": "application/json", ...options.headers }
    if (token) headers["Authorization"] = "Bearer " + token

    try {
      const res  = await fetch(SERVER + path, { ...options, headers })
      const data = await res.json()
      if (res.status === 401) {
        Session.clear()
        window.location.href = "login.html"
        return null
      }
      return data
    } catch(e) {
      showToast("Server unreachable", "error")
      return null
    }
  },
  async register(id, pubKey, password) {
    return this._fetch("/register", { method: "POST", body: JSON.stringify({ id, pubKey, password }) })
  },
  async login(id, password, token2FA) {
    return this._fetch("/login", { method: "POST", body: JSON.stringify({ id, password, token2FA }) })
  },
  async getUser(id)  { return this._fetch("/user/" + id) },
  async getLedger()  { return this._fetch("/ledger") },
  async getPrice()   { return this._fetch("/price") },
  async send(senderId, receiverId, amount, note, signature, token2FA, pubKey) {
    return this._fetch("/send", {
      method: "POST",
      body: JSON.stringify({ senderId, receiverId, amount, note, signature, token2FA, pubKey })
    })
  },
  async changePassword(oldPassword, newPassword) {
    return this._fetch("/settings/password", {
      method: "POST",
      body: JSON.stringify({ oldPassword, newPassword })
    })
  }
}

// ===== CRYPTO =====
const Crypto = {
  generateKeys() {
    const kp = nacl.sign.keyPair()
    return {
      pubKey:  nacl.util.encodeBase64(kp.publicKey),
      privKey: nacl.util.encodeBase64(kp.secretKey)
    }
  },
  sign(senderId, receiverId, amount, note, privBase64) {
    const kp   = nacl.sign.keyPair.fromSecretKey(nacl.util.decodeBase64(privBase64))
    const data = { SENDER: { ID: senderId, QUANTITY: amount, NOTE: note || "" }, RECEIVER: { ID: receiverId } }
    const sig  = nacl.sign.detached(nacl.util.decodeUTF8(JSON.stringify(data)), kp.secretKey)
    return nacl.util.encodeBase64(sig)
  }
}

// ===== UTILS =====
function showToast(msg, type) {
  type = type || "info"
  let t = document.getElementById("toast")
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t) }
  t.textContent = msg
  t.className = "toast " + type
  t.classList.remove("hidden")
  clearTimeout(t._timer)
  t._timer = setTimeout(function() { t.classList.add("hidden") }, 3500)
}

function requireAuth() {
  if (!Session.isLoggedIn()) window.location.href = "login.html"
}

function checkServerStatus() {
  fetch(SERVER + "/price")
    .then(function() {
      var dot  = document.querySelector(".status-dot")
      var text = document.querySelector(".status-text")
      if (dot)  dot.classList.add("online")
      if (text) text.textContent = "ONLINE"
    })
    .catch(function() {
      var dot  = document.querySelector(".status-dot")
      var text = document.querySelector(".status-text")
      if (dot)  dot.classList.remove("online")
      if (text) text.textContent = "OFFLINE"
    })
}
