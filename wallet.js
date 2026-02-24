// ===== CONFIG =====
const SERVER = "https://arcacoin.duckdns.org"

// ===== STATE =====
let state = {
  userId:    null,
  pubKey:    null,
  privKey:   null,
  secret2FA: null,
  balance:   null,
  trust:     null
}

// ===== UTILS =====
function $(id) { return document.getElementById(id) }

function showToast(msg, type = "info") {
  const t = $("toast")
  t.textContent = msg
  t.className = `toast ${type}`
  t.classList.remove("hidden")
  setTimeout(() => t.classList.add("hidden"), 3500)
}

function showCard(id) {
  ;["blockNoAccount","blockRegister","blockAccount"].forEach(b => {
    $(b).classList.add("hidden")
    $(b).classList.remove("active")
  })
  $(id).classList.remove("hidden")
  $(id).classList.add("active")
}

function saveSession() {
  localStorage.setItem("arcoin_session", JSON.stringify({
    userId:    state.userId,
    pubKey:    state.pubKey,
    privKey:   state.privKey,
    secret2FA: state.secret2FA
  }))
}

function loadSession() {
  const raw = localStorage.getItem("arcoin_session")
  if (!raw) return false
  const s = JSON.parse(raw)
  if (!s.userId || !s.privKey) return false
  state.userId    = s.userId
  state.pubKey    = s.pubKey
  state.privKey   = s.privKey
  state.secret2FA = s.secret2FA
  return true
}

function clearSession() {
  localStorage.removeItem("arcoin_session")
  state = { userId: null, pubKey: null, privKey: null, secret2FA: null, balance: null, trust: null }
}

// ===== CRYPTO =====
function generateKeys() {
  const kp = nacl.sign.keyPair()
  return {
    pubKey:  nacl.util.encodeBase64(kp.publicKey),
    privKey: nacl.util.encodeBase64(kp.secretKey),
    keyPair: kp
  }
}

function getKeyPairFromPriv(privBase64) {
  const sk = nacl.util.decodeBase64(privBase64)
  return nacl.sign.keyPair.fromSecretKey(sk)
}

function signTransaction(senderId, receiverId, amount, note, privBase64) {
  const kp = getKeyPairFromPriv(privBase64)
  const data = {
    SENDER:   { ID: senderId,   QUANTITY: amount, NOTE: note || "" },
    RECEIVER: { ID: receiverId }
  }
  const msg = JSON.stringify(data)
  const sig = nacl.sign.detached(nacl.util.decodeUTF8(msg), kp.secretKey)
  return nacl.util.encodeBase64(sig)
}

// ===== 2FA =====
function generateOTP(secret) {
  // utilise totp-generator (chargé en UMD)
  try {
    const token = window.TOTPGenerator
      ? window.TOTPGenerator.default(secret)
      : TOTP.generate(secret).otp
    return token
  } catch(e) {
    // fallback manuel si lib pas dispo
    return $("input2FA")?.value || ""
  }
}

// ===== SERVER CALLS =====
async function apiRegister(userId, pubKey) {
  const res = await fetch(`${SERVER}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: userId, pubKey })
  })
  return res.json()
}

async function apiGetUser(userId) {
  const res = await fetch(`${SERVER}/user/${userId}`)
  return res.json()
}

async function apiSend(senderId, receiverId, amount, note, signature, token2FA, pubKey) {
  const res = await fetch(`${SERVER}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senderId, receiverId, amount, note, signature, token2FA, pubKey })
  })
  return res.json()
}

async function apiLedger() {
  const res = await fetch(`${SERVER}/ledger`)
  return res.json()
}

// ===== CHECK SERVER STATUS =====
async function checkStatus() {
  try {
    await fetch(`${SERVER}/ledger`)
    $("statusDot").className  = "status-dot online"
    $("statusText").textContent = "ONLINE"
  } catch {
    $("statusDot").className  = "status-dot offline"
    $("statusText").textContent = "OFFLINE"
  }
}

// ===== REFRESH ACCOUNT =====
async function refreshAccount() {
  if (!state.userId) return
  const data = await apiGetUser(state.userId)
  if (data.error) { showToast(data.error, "error"); return }
  state.balance = data.balance
  state.trust   = data.trust
  $("displayBalance").textContent = data.balance
  $("trustFill").style.width      = `${data.trust}%`
  $("trustValue").textContent     = data.trust
}

// ===== QR CODE 2FA =====
function show2FA(secret, userId) {
  $("block2FA").classList.remove("hidden")
  $("display2FASecret").textContent = secret
  $("qrcode").innerHTML = ""
  const otpUrl = `otpauth://totp/ArcaCoin%20(${userId})?secret=${secret}&issuer=ArcaCoin`
  new QRCode($("qrcode"), {
    text:   otpUrl,
    width:  160,
    height: 160,
    colorDark:  "#000000",
    colorLight: "#ffffff"
  })
}

// ===== OTP COUNTDOWN =====
function startOTPCountdown() {
  function tick() {
    const now   = Math.floor(Date.now() / 1000)
    const rem   = 30 - (now % 30)
    const pct   = (rem / 30) * 100
    $("otpCountdown").textContent = `${rem}s`
    $("otpFill").style.width      = `${pct}%`
    $("otpFill").classList.toggle("urgent", rem <= 7)
  }
  tick()
  setInterval(tick, 1000)
}

// ===== TABS =====
document.querySelectorAll(".tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.remove("active"))
    document.querySelectorAll(".tab-content").forEach(c => {
      c.classList.remove("active")
      c.classList.add("hidden")
    })
    tab.classList.add("active")
    const target = $("tab" + tab.dataset.tab.charAt(0).toUpperCase() + tab.dataset.tab.slice(1))
    target.classList.remove("hidden")
    target.classList.add("active")
  })
})

// ===== EVENTS =====

// Générer les clés
$("btnGenerate").addEventListener("click", () => {
  const { pubKey, privKey } = generateKeys()
  state.pubKey = pubKey
  state.privKey = privKey
  $("displayPubKey").textContent  = pubKey
  $("displayPrivKey").textContent = privKey
  showCard("blockRegister")
})

// Importer une clé
$("btnImport").addEventListener("click", () => {
  $("importArea").classList.toggle("hidden")
})

$("btnImportConfirm").addEventListener("click", () => {
  const privRaw = $("importPrivKey").value.trim()
  if (!privRaw) { showToast("Colle ta clé privée", "error"); return }
  try {
    const kp = getKeyPairFromPriv(privRaw)
    state.privKey = privRaw
    state.pubKey  = nacl.util.encodeBase64(kp.publicKey)
    $("displayPubKey").textContent  = state.pubKey
    $("displayPrivKey").textContent = state.privKey
    showCard("blockRegister")
  } catch {
    showToast("Clé invalide", "error")
  }
})

// Reveal clé privée
$("btnReveal").addEventListener("click", () => {
  const el = $("displayPrivKey")
  el.classList.toggle("revealed")
  $("btnReveal").textContent = el.classList.contains("revealed") ? "MASQUER" : "AFFICHER"
})

// Copy pubkey on click
$("displayPubKey").addEventListener("click", () => {
  navigator.clipboard.writeText(state.pubKey || "")
  showToast("Clé publique copiée !", "success")
})

// Register
$("btnRegister").addEventListener("click", async () => {
  const userId = $("inputUserId").value.trim()
  if (!userId) { showToast("Entre un ID utilisateur", "error"); return }
  if (!state.pubKey) { showToast("Génère des clés d'abord", "error"); return }

  $("btnRegister").textContent = "..."
  const data = await apiRegister(userId, state.pubKey)
  $("btnRegister").textContent = "CRÉER LE COMPTE"

  if (!data.success) { showToast(data.error || "Erreur serveur", "error"); return }

  state.userId    = userId
  state.secret2FA = data.secret2FA
  saveSession()

  $("displayAccountId").textContent = userId
  showCard("blockAccount")
  await refreshAccount()
  show2FA(data.secret2FA, userId)
  showToast("Compte créé ! Configure ton 2FA 🎉", "success")
})

// Confirmer 2FA setup
$("btnConfirm2FA").addEventListener("click", () => {
  $("block2FA").classList.add("hidden")
  showToast("2FA configuré ✓", "success")
})

// Refresh balance
$("btnRefresh").addEventListener("click", async () => {
  await refreshAccount()
  showToast("Balance mise à jour", "success")
})

// Logout
$("btnLogout").addEventListener("click", () => {
  clearSession()
  showCard("blockNoAccount")
  showToast("Déconnecté", "info")
})

// Envoyer transaction
$("btnSend").addEventListener("click", async () => {
  if (!state.userId) { showToast("Connecte-toi d'abord", "error"); return }

  const receiverId = $("inputReceiver").value.trim()
  const amount     = parseInt($("inputAmount").value)
  const note       = $("inputNote").value.trim()
  const token2FA   = $("input2FA").value.trim()

  if (!receiverId) { showToast("Entre un destinataire", "error"); return }
  if (!amount || amount <= 0) { showToast("Montant invalide", "error"); return }
  if (!token2FA) { showToast("Entre ton code 2FA", "error"); return }

  const signature = signTransaction(state.userId, receiverId, amount, note, state.privKey)

  $("btnSend").textContent = "..."
  const data = await apiSend(state.userId, receiverId, amount, note, signature, token2FA, state.pubKey)
  $("btnSend").textContent = "ENVOYER →"

  const result = $("txResult")
  result.classList.remove("hidden", "success", "error")

  if (data.success) {
    result.classList.add("success")
    result.innerHTML = `✓ TX CONFIRMÉE<br>ID: ${data.transaction.id}<br>${state.userId} → ${receiverId}: ${amount} ARC`
    await refreshAccount()
    showToast("Transaction envoyée !", "success")
    $("input2FA").value = ""
  } else {
    result.classList.add("error")
    result.textContent = `✗ ERREUR: ${data.error}`
    showToast(data.error, "error")
  }
})

// Charger historique
$("btnLoadHistory").addEventListener("click", async () => {
  const data = await apiLedger()
  const list = $("historyList")
  list.innerHTML = ""

  if (!data.transactions || data.transactions.length === 0) {
    list.innerHTML = '<div class="empty-state">Aucune transaction</div>'
    return
  }

  // Afficher les plus récentes en premier
  ;[...data.transactions].reverse().forEach(tx => {
    const div = document.createElement("div")
    div.className = "tx-item"
    div.innerHTML = `
      <div class="tx-id"># ${tx.id}</div>
      <div><span class="tx-from">${tx.SENDER.ID}</span> → <span class="tx-to">${tx.RECEIVER.ID}</span> : <span class="tx-amt">${tx.SENDER.QUANTITY} ARC</span></div>
      ${tx.SENDER.NOTE ? `<div style="color:var(--text-dim)">${tx.SENDER.NOTE}</div>` : ""}
      <div class="tx-time">${tx.WHEN} ${tx.TIME} · <span class="tx-status-${tx.STATUS}">${tx.STATUS.toUpperCase()}</span></div>
    `
    list.appendChild(div)
  })
})

// ===== INIT =====
async function init() {
  checkStatus()
  setInterval(checkStatus, 30000)
  startOTPCountdown()

  // Restore session
  if (loadSession()) {
    $("displayAccountId").textContent = state.userId
    showCard("blockAccount")
    await refreshAccount()
    showToast(`Bienvenue ${state.userId} 👋`, "success")
  } else {
    showCard("blockNoAccount")
  }
}

init()
