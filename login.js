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

  if (!id || !password || !token2FA) {
    showToast("Please fill in all fields", "error")
    return
  }

  const btn = document.getElementById("btnLogin")
  btn.disabled = true
  btn.textContent = "Signing in..."

  const data = await API.login(id, password, token2FA)

  btn.disabled = false
  btn.textContent = "Sign In"

  if (!data) {
    showToast("Server unreachable", "error")
    return
  }

  if (!data.success) {
    showToast(data.error || "Login failed", "error")
    return
  }

  Session.set(data.token, data.user)
  window.location.href = "wallet.html"
})

document.getElementById("login2FA").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btnLogin").click()
})

// ===== REGISTER =====
let regKeys      = null
let reg2FASecret = null
let regId        = null

document.getElementById("btnStep1").addEventListener("click", async () => {
  const id      = document.getElementById("regId").value.trim()
  const pass    = document.getElementById("regPassword").value
  const confirm = document.getElementById("regPasswordConfirm").value

  if (!id)              { showToast("Enter a username", "error"); return }
  if (pass.length < 8)  { showToast("Password too short (8 min)", "error"); return }
  if (pass !== confirm) { showToast("Passwords don't match", "error"); return }

  const btn = document.getElementById("btnStep1")
  btn.disabled = true
  btn.textContent = "Creating..."

  regKeys = Crypto.generateKeys()
  regId   = id

  const data = await API.register(id, regKeys.pubKey, pass)

  btn.disabled = false
  btn.textContent = "Next →"

  if (!data) {
    showToast("Server unreachable", "error")
    return
  }

  if (!data.success) {
    showToast(data.error || "Registration failed", "error")
    return
  }

  reg2FASecret = data.secret2FA

  // Afficher les clés
  document.getElementById("regPubKey").textContent  = regKeys.pubKey
  document.getElementById("regPrivKey").textContent = regKeys.privKey

  // Passer au step 2
  document.getElementById("step1").classList.add("hidden")
  document.getElementById("step2").classList.remove("hidden")

  // Afficher le secret
  document.getElementById("reg2FASecret").textContent = reg2FASecret

  // Générer le QR
  document.getElementById("qrWrap").innerHTML = ""
  const otpUrl = `otpauth://totp/${id}?secret=${reg2FASecret}&issuer=ArcaCoin`
  new QRCode(document.getElementById("qrWrap"), {
    text: otpUrl, width: 150, height: 150,
    colorDark: "#000", colorLight: "#fff"
  })

  showToast("Account created! Scan the QR code then sign in.", "success")
})

document.getElementById("btnBackStep1").addEventListener("click", () => {
  document.getElementById("step2").classList.add("hidden")
  document.getElementById("step1").classList.remove("hidden")
})

document.getElementById("btnRevealPriv").addEventListener("click", () => {
  const el = document.getElementById("regPrivKey")
  el.classList.toggle("revealed")
  document.getElementById("btnRevealPriv").textContent =
    el.classList.contains("revealed") ? "Hide" : "Show"
})

document.getElementById("btnCopyPriv").addEventListener("click", () => {
  navigator.clipboard.writeText(regKeys?.privKey || "")
  showToast("Private key copied!", "success")
})

// Bouton "Create Account" = juste basculer vers Sign In
document.getElementById("btnRegisterConfirm").addEventListener("click", () => {
  if (!reg2FASecret) {
    showToast("Please wait for QR code", "error")
    return
  }

  // Pré-remplir l'ID dans le formulaire login
  document.getElementById("loginId").value = regId || ""

  // Basculer vers Sign In
  document.getElementById("tabLogin").click()

  showToast("Now scan the QR, then sign in!", "success")
})

// ===== INIT =====
startOTPCountdown()
checkServerStatus()

if (Session.isLoggedIn()) {
  window.location.href = "wallet.html"
}
