// ===== OTP COUNTDOWN =====
function startOTPCountdown() {
  function tick() {
    const rem  = 30 - (Math.floor(Date.now() / 1000) % 30)
    const pct  = (rem / 30) * 100
    const fill = document.getElementById("otpFill")
    const time = document.getElementById("otpTime")
    if (fill) { fill.style.width = `${pct}%`; fill.classList.toggle("urgent", rem <= 7) }
    if (time) time.textContent = `${rem}s`
  }
  tick()
  setInterval(tick, 1000)
}

// ===== TABS =====
document.getElementById("tabLogin").addEventListener("click", () => {
  document.getElementById("tabLogin").classList.add("active")
  document.getElementById("tabRegister").classList.remove("active")
  document.getElementById("formLogin").classList.remove("hidden")
  document.getElementById("formRegister").classList.add("hidden")
})

document.getElementById("tabRegister").addEventListener("click", () => {
  document.getElementById("tabRegister").classList.add("active")
  document.getElementById("tabLogin").classList.remove("active")
  document.getElementById("formRegister").classList.remove("hidden")
  document.getElementById("formLogin").classList.add("hidden")
})

// ===== LOGIN =====
document.getElementById("btnLogin").addEventListener("click", async () => {
  const id       = document.getElementById("loginId").value.trim()
  const password = document.getElementById("loginPassword").value
  const token2FA = document.getElementById("login2FA").value.trim()

  if (!id || !password || !token2FA) { showToast("Please fill in all fields", "error"); return }

  const btn = document.getElementById("btnLogin")
  btn.disabled = true
  btn.textContent = "Signing in..."

  const data = await API.login(id, password, token2FA)

  btn.disabled = false
  btn.textContent = "Sign In"

  if (!data || !data.success) { showToast(data?.error || "Server error", "error"); return }

  Session.set(data.token, data.user)
  window.location.href = "wallet.html"
})

document.getElementById("login2FA").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btnLogin").click()
})

// ===== REGISTER =====
let regKeys      = null
let reg2FASecret = null

// STEP 1 → STEP 2 : juste les infos, pas encore de register
document.getElementById("btnStep1").addEventListener("click", () => {
  const id      = document.getElementById("regId").value.trim()
  const pass    = document.getElementById("regPassword").value
  const confirm = document.getElementById("regPasswordConfirm").value

  if (!id)              { showToast("Enter a username", "error"); return }
  if (pass.length < 8)  { showToast("Password too short (8 min)", "error"); return }
  if (pass !== confirm) { showToast("Passwords don't match", "error"); return }

  // Générer les clés
  regKeys = Crypto.generateKeys()
  document.getElementById("regPubKey").textContent  = regKeys.pubKey
  document.getElementById("regPrivKey").textContent = regKeys.privKey

  // Afficher step2 AVANT tout le reste
  document.getElementById("step1").classList.add("hidden")
  document.getElementById("step2").classList.remove("hidden")

  // Enregistrer le compte dès maintenant pour avoir le secret 2FA
  // et afficher le QR code immédiatement
  registerAndShowQR(id, pass)
})

// Fonction séparée : register + afficher QR
async function registerAndShowQR(id, password) {
  const data = await API.register(id, regKeys.pubKey, password)

  if (!data || !data.success) {
    showToast(data?.error || "Server error", "error")
    // Revenir au step 1
    document.getElementById("step2").classList.add("hidden")
    document.getElementById("step1").classList.remove("hidden")
    return
  }

  reg2FASecret = data.secret2FA

  // Afficher le secret en texte
  document.getElementById("reg2FASecret").textContent = reg2FASecret

  // Générer le QR — step2 est déjà visible ici
  document.getElementById("qrWrap").innerHTML = ""
  const otpUrl = `otpauth://totp/${id}?secret=${reg2FASecret}&issuer=ArcaCoin`
  new QRCode(document.getElementById("qrWrap"), {
    text: otpUrl, width: 150, height: 150,
    colorDark: "#000", colorLight: "#fff"
  })

  showToast("Account created! Scan the QR code now.", "success")
}

document.getElementById("btnBackStep1").addEventListener("click", () => {
  document.getElementById("step2").classList.add("hidden")
  document.getElementById("step1").classList.remove("hidden")
})

// Reveal clé privée
document.getElementById("btnRevealPriv").addEventListener("click", () => {
  const el = document.getElementById("regPrivKey")
  el.classList.toggle("revealed")
  document.getElementById("btnRevealPriv").textContent =
    el.classList.contains("revealed") ? "Hide" : "Show"
})

// Copier clé privée
document.getElementById("btnCopyPriv").addEventListener("click", () => {
  navigator.clipboard.writeText(regKeys?.privKey || "")
  showToast("Private key copied!", "success")
})

// Confirmer 2FA + se connecter
document.getElementById("btnRegisterConfirm").addEventListener("click", async () => {
  const id      = document.getElementById("regId").value.trim()
  const password = document.getElementById("regPassword").value
  const code2FA  = document.getElementById("reg2FACode").value.trim()

  if (!code2FA)        { showToast("Enter the 2FA code to confirm", "error"); return }
  if (!reg2FASecret)   { showToast("Please wait for QR code to load", "error"); return }

  const btn = document.getElementById("btnRegisterConfirm")
  btn.disabled = true
  btn.textContent = "Connecting..."

  // Login direct avec le code 2FA scanné
  const loginData = await API.login(id, password, code2FA)

  btn.disabled = false
  btn.textContent = "Create Account"

  if (!loginData || !loginData.success) {
    showToast(loginData?.error || "Invalid 2FA code — try again", "error")
    return
  }

  Session.set(loginData.token, { ...loginData.user, privKey: regKeys.privKey })
  window.location.href = "wallet.html"
})

// ===== INIT =====
startOTPCountdown()
checkServerStatus()

if (Session.isLoggedIn()) {
  window.location.href = "wallet.html"
}
