// ===== CONFIG =====
const SERVER = "https://arcacoin.duckdns.org"

// ===== SESSION =====
// sessionStorage : survit à la navigation entre pages
// mais disparaît à la fermeture de l'onglet → déconnexion auto ✓
const Session = {
  set(token, user) {
    sessionStorage.setItem("arc_token", token)
    sessionStorage.setItem("arc_user", JSON.stringify(user))
  },
  getToken() {
    return sessionStorage.getItem("arc_token")
  },
  getUser() {
    const raw = sessionStorage.getItem("arc_user")
    return raw ? JSON.parse(raw) : null
  },
  clear() {
    sessionStorage.removeItem("arc_token")
    sessionStorage.removeItem("arc_user")
  },
  isLoggedIn() {
    return !!sessionStorage.getItem("arc_token")
  }
}

// ===== API =====
const API = {
  async _fetch(path, options = {}) {
    const token = Session.getToken()
    const headers = { "Content-Type": "application/json", ...options.headers }
    if (token) headers["Authorization"] = `Bearer ${token}`

    try {
      const res  = await fetch(`${SERVER}${path}`, { ...options, headers })
      const data = await res.json()
      if (res.status === 401) {
        Session.clear()
        window.location.href = "/arcoin/login.html"
        return null
      }
      return data
    } catch {
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
  async getUser(id)  { return this._fetch(`/user/${id}`) },
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
  getKeyPairFromPriv(privBase64) {
    return nacl.sign.keyPair.fromSecretKey(nacl.util.decodeBase64(privBase64))
  },
  sign(senderId, receiverId, amount, note, privBase64) {
    const kp   = this.getKeyPairFromPriv(privBase64)
    const data = { SENDER: { ID: senderId, QUANTITY: amount, NOTE: note || "" }, RECEIVER: { ID: receiverId } }
    const sig  = nacl.sign.detached(nacl.util.decodeUTF8(JSON.stringify(data)), kp.secretKey)
    return nacl.util.encodeBase64(sig)
  }
}

// ===== UTILS =====
function showToast(msg, type = "info") {
  let t = document.getElementById("toast")
  if (!t) { t = document.createElement("div"); t.id = "toast"; document.body.appendChild(t) }
  t.textContent = msg
  t.className = `toast ${type}`
  t.classList.remove("hidden")
  clearTimeout(t._timer)
  t._timer = setTimeout(() => t.classList.add("hidden"), 3500)
}

function requireAuth() {
  if (!Session.isLoggedIn()) {
    window.location.href = "/arcoin/login.html"
  }
}

function checkServerStatus() {
  fetch(`${SERVER}/price`)
    .then(() => {
      const dot  = document.querySelector(".status-dot")
      const text = document.querySelector(".status-text")
      if (dot)  dot.classList.add("online")
      if (text) text.textContent = "ONLINE"
    })
    .catch(() => {
      const dot  = document.querySelector(".status-dot")
      const text = document.querySelector(".status-text")
      if (dot)  dot.classList.remove("online")
      if (text) text.textContent = "OFFLINE"
    })
}
