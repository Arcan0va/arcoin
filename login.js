// ===== OTP COUNTDOWN =====
function startOTPCountdown() {
  function tick() {
    const rem = 30 - (Math.floor(Date.now() / 1000) % 30)
    const pct = (rem / 30) * 100
    const fill = document.getElementById("otpFill")
    const time = document.getElementById("otpTime")
    if (fill) fill.style.width = `${pct}%`
    if (fill) fill.classList.toggle("urgent", rem <= 7)
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
    showToast("Remplis tous les champs", "error")
    return
  }

  const btn = document.getElementById("btnLogin")
  btn.disabled = true
  btn.textContent = "Connexion..."

  const data = await API.login(id, password, token2FA)

  btn.disabled = false
  btn.textContent = "Se connecter"

  if (!data || !data.success) {
    showToast(data?.error || "Erreur serveur", "error")
    return
  }

  // Stocker la session + clé privée (saisie non demandée ici, on redirige)
  Session.set(data.token, data.user)

  // Rediriger vers wallet
  window.location.href = "wallet.html"
})

// Entrée clavier
document.getElementById("login2FA").addEventListener("keydown", e => {
  if (e.key === "Enter") document.getElementById("btnLogin").click()
})

// ===== REGISTER =====
let regKeys = null
let reg2FASecret = null

// Step 1 → Step 2
document.getElementById("btnStep1").addEventListener("click", () => {
  const id      = document.getElementById("regId").value.trim()
  const pass    = document.getElementById("regPassword").value
  const confirm = document.getElementById("regPasswordConfirm").value

  if (!id)               { showToast("Entre un identifiant", "error"); return }
  if (pass.length < 8)   { showToast("Mot de passe trop court (8 min)", "error"); return }
  if (pass !== confirm)  { showToast("Les mots de passe ne correspondent pas", "error"); return }

  // Générer les clés
  regKeys = Crypto.generateKeys()

  document.getElementById("regPubKey").textContent  = regKeys.pubKey
  document.getElementById("regPrivKey").textContent = regKeys.privKey

  document.getElementById("step1").classList.add("hidden")
  document.getElementById("step2").classList.remove("hidden")
})

document.getElementById("btnBackStep1").addEventListener("click", () => {
  document.getElementById("step2").classList.add("hidden")
  document.getElementById("step1").classList.remove("hidden")
})

// Reveal clé privée
document.getElementById("btnRevealPriv").addEventListener("click", () => {
  const el = document.getElementById("regPrivKey")
  el.classList.toggle("revealed")
  document.getElementById("btnRevealPriv").textContent =
    el.classList.contains("revealed") ? "Masquer" : "Afficher"
})

// Copier clé privée
document.getElementById("btnCopyPriv").addEventListener("click", () => {
  navigator.clipboard.writeText(regKeys?.privKey || "")
  showToast("Clé privée copiée !", "success")
})

// Créer le compte
document.getElementById("btnRegisterConfirm").addEventListener("click", async () => {
  const id       = document.getElementById("regId").value.trim()
  const password = document.getElementById("regPassword").value
  const code2FA  = document.getElementById("reg2FACode").value.trim()

  if (!code2FA) { showToast("Entre le code 2FA pour valider", "error"); return }
  if (!regKeys) { showToast("Génère tes clés d'abord", "error"); return }

  const btn = document.getElementById("btnRegisterConfirm")
  btn.disabled = true
  btn.textContent = "Création..."

  const data = await API.register(id, regKeys.pubKey, password)

  if (!data || !data.success) {
    btn.disabled = false
    btn.textContent = "Créer le compte"
    showToast(data?.error || "Erreur serveur", "error")
    return
  }

  reg2FASecret = data.secret2FA

  // Afficher QR code
  document.getElementById("reg2FASecret").textContent = reg2FASecret
  document.getElementById("qrWrap").innerHTML = ""
  const otpUrl = `otpauth://totp/${id}?secret=${reg2FASecret}&issuer=ArcaCoin`
  new QRCode(document.getElementById("qrWrap"), {
    text: otpUrl, width: 150, height: 150,
    colorDark: "#000", colorLight: "#fff"
  })

  // Vérifier le code 2FA saisi
  // On fait confiance à l'utilisateur ici (le serveur valide de toute façon au login)
  // On connecte directement après register
  const loginData = await API.login(id, password, code2FA)

  btn.disabled = false
  btn.textContent = "Créer le compte"

  if (!loginData || !loginData.success) {
    showToast("Compte créé ! Connecte-toi maintenant.", "success")
    // Basculer sur l'onglet login
    document.getElementById("tabLogin").click()
    return
  }

  // Stocker session + rediriger
  Session.set(loginData.token, { ...loginData.user, privKey: regKeys.privKey })
  window.location.href = "wallet.html"
})

// ===== INIT =====
startOTPCountdown()
checkServerStatus()

// Si déjà connecté → wallet directement
if (Session.isLoggedIn()) {
  window.location.href = "wallet.html"
}
