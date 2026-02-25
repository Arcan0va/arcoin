// ===== OTP COUNTDOWN =====
function startOTPCountdown() {
  function tick() {
    var rem  = 30 - (Math.floor(Date.now() / 1000) % 30)
    var pct  = (rem / 30) * 100
    var fill = document.getElementById("otpFill")
    var time = document.getElementById("otpTime")
    if (fill) { fill.style.width = pct + "%"; fill.classList.toggle("urgent", rem <= 7) }
    if (time) time.textContent = rem + "s"
  }
  tick()
  setInterval(tick, 1000)
}

// ===== TABS =====
document.getElementById("tabLogin").addEventListener("click", function() {
  document.getElementById("tabLogin").classList.add("active")
  document.getElementById("tabRegister").classList.remove("active")
  document.getElementById("formLogin").classList.remove("hidden")
  document.getElementById("formRegister").classList.add("hidden")
})

document.getElementById("tabRegister").addEventListener("click", function() {
  document.getElementById("tabRegister").classList.add("active")
  document.getElementById("tabLogin").classList.remove("active")
  document.getElementById("formRegister").classList.remove("hidden")
  document.getElementById("formLogin").classList.add("hidden")
})

// ===== LOGIN =====
document.getElementById("btnLogin").addEventListener("click", async function() {
  var id         = document.getElementById("loginId").value.trim()
  var password   = document.getElementById("loginPassword").value
  var token2FA   = document.getElementById("login2FA").value.trim()
  var staySignedIn = document.getElementById("staySignedIn").checked

  if (!id || !password || !token2FA) {
    showToast("Please fill in all fields", "error")
    return
  }

  var btn = document.getElementById("btnLogin")
  btn.disabled = true
  btn.textContent = "Signing in..."

  var data = await API.login(id, password, token2FA)

  btn.disabled = false
  btn.textContent = "Sign In"

  if (!data) return

  if (!data.success) {
    showToast(data.error || "Login failed", "error")
    return
  }

  // Clé privée déjà sauvegardée sur cet appareil ?
  var savedPrivKey = Session.getPrivKey(id)

  Session.set(data.token, data.user, staySignedIn)

  if (savedPrivKey) {
    window.location.href = "wallet.html"
    return
  }

  // Première fois sur cet appareil — demander la clé privée
  document.getElementById("privKeySection").classList.remove("hidden")
  document.getElementById("btnLogin").disabled = true
  window._pendingStay = staySignedIn
  window._pendingId   = id
  showToast("Enter your private key to continue", "info")
})

document.getElementById("btnConfirmPrivKey").addEventListener("click", function() {
  var privKey = document.getElementById("loginPrivKey").value.trim()
  if (!privKey) { showToast("Enter your private key", "error"); return }
  Session.savePrivKey(window._pendingId, privKey)
  window.location.href = "wallet.html"
})

document.getElementById("login2FA").addEventListener("keydown", function(e) {
  if (e.key === "Enter") document.getElementById("btnLogin").click()
})

// ===== REGISTER =====
var regKeys      = null
var reg2FASecret = null
var regId        = null

document.getElementById("btnStep1").addEventListener("click", async function() {
  var id      = document.getElementById("regId").value.trim()
  var pass    = document.getElementById("regPassword").value
  var confirm = document.getElementById("regPasswordConfirm").value

  if (!id)              { showToast("Enter a username", "error"); return }
  if (pass.length < 8)  { showToast("Password too short (8 min)", "error"); return }
  if (pass !== confirm) { showToast("Passwords don't match", "error"); return }

  var btn = document.getElementById("btnStep1")
  btn.disabled = true
  btn.textContent = "Creating..."

  regKeys = Crypto.generateKeys()
  regId   = id

  var data = await API.register(id, regKeys.pubKey, pass)

  btn.disabled = false
  btn.textContent = "Next →"

  if (!data) return

  if (!data.success) {
    showToast(data.error || "Registration failed", "error")
    return
  }

  reg2FASecret = data.secret2FA

  document.getElementById("regPubKey").textContent  = regKeys.pubKey
  document.getElementById("regPrivKey").textContent = regKeys.privKey

  document.getElementById("step1").classList.add("hidden")
  document.getElementById("step2").classList.remove("hidden")

  document.getElementById("reg2FASecret").textContent = reg2FASecret

  document.getElementById("qrWrap").innerHTML = ""
  var otpUrl = "otpauth://totp/" + id + "?secret=" + reg2FASecret + "&issuer=ArcaCoin"
  new QRCode(document.getElementById("qrWrap"), {
    text: otpUrl, width: 150, height: 150,
    colorDark: "#000", colorLight: "#fff"
  })

  // Sauvegarder la clé privée sur cet appareil
  Session.savePrivKey(id, regKeys.privKey)

  showToast("Account created! Scan the QR code then sign in.", "success")
})

document.getElementById("btnBackStep1").addEventListener("click", function() {
  document.getElementById("step2").classList.add("hidden")
  document.getElementById("step1").classList.remove("hidden")
})

document.getElementById("btnRevealPriv").addEventListener("click", function() {
  var el = document.getElementById("regPrivKey")
  el.classList.toggle("revealed")
  document.getElementById("btnRevealPriv").textContent =
    el.classList.contains("revealed") ? "Hide" : "Show"
})

document.getElementById("btnCopyPriv").addEventListener("click", function() {
  navigator.clipboard.writeText(regKeys ? regKeys.privKey : "")
  showToast("Private key copied!", "success")
})

document.getElementById("btnRegisterConfirm").addEventListener("click", function() {
  if (!reg2FASecret) { showToast("Please wait for QR code", "error"); return }
  document.getElementById("loginId").value = regId || ""
  document.getElementById("tabLogin").click()
  showToast("Now open Google Authenticator and sign in!", "success")
})

// ===== INIT =====
startOTPCountdown()
checkServerStatus()

if (Session.isLoggedIn()) {
  window.location.href = "wallet.html"
}
