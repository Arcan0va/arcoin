// ===== AUTH =====
requireAuth()

const user   = Session.getUser()
const userId = user?.id

// ===== THREAD LIMIT SELON TRUST =====
function getBaseThreads(trust) {
  if (trust >= 500) return 500  // owner
  if (trust >= 250) return 200  // modo
  if (trust >= 175) return 100  // node owner
  if (trust >= 150) return 50
  if (trust >= 100) return 25
  if (trust >= 50)  return 10
  return 5
}

// ===== INIT =====
async function init() {
  checkServerStatus()

  const data = await API.getUser(userId)
  if (!data || data.error) return

  const trust       = data.trust || 50
  const balance     = data.balance || 0
  const threadBase  = getBaseThreads(trust)
  const threadBought = (data.threadsBought || 0) * 25
  const threadTotal  = threadBase + threadBought
  const packsBought  = data.threadsBought || 0

  document.getElementById("threadCurrent").textContent = threadTotal
  document.getElementById("threadBase").textContent    = threadBase
  document.getElementById("threadBought").textContent  = threadBought
  document.getElementById("threadTotal").textContent   = threadTotal
  document.getElementById("minersBalance").textContent = balance
  document.getElementById("packsBought").textContent   = packsBought

  // Devices équivalents
  document.getElementById("esp32Count").textContent  = Math.floor(threadTotal / 2) + " max"
  document.getElementById("piZeroCount").textContent = threadTotal + " max"
  document.getElementById("pi23Count").textContent   = Math.floor(threadTotal / 2) + " max"
  document.getElementById("pi4Count").textContent    = Math.floor(threadTotal / 4) + " max"
  document.getElementById("pi5Count").textContent    = Math.floor(threadTotal / 8) + " max"

  // Max packs restants
  const packsLeft = 5 - packsBought
  window._packsLeft   = packsLeft
  window._balance     = balance
  window._packsBought = packsBought
  updatePackUI()
}

// ===== BUY PACKS =====
let packQty = 0

function updatePackUI() {
  document.getElementById("packQty").textContent   = packQty
  document.getElementById("packTotal").textContent = (packQty * 10000).toLocaleString() + " ARC"
}

document.getElementById("packPlus").addEventListener("click", function() {
  const maxBuy = Math.min(5 - (window._packsBought || 0), Math.floor((window._balance || 0) / 10000))
  if (packQty < maxBuy) {
    packQty++
    updatePackUI()
  } else {
    showToast("Max 5 packs or insufficient balance", "error")
  }
})

document.getElementById("packMinus").addEventListener("click", function() {
  if (packQty > 0) { packQty--; updatePackUI() }
})

document.getElementById("btnBuyThreads").addEventListener("click", async function() {
  if (packQty === 0) { showToast("Select at least 1 pack", "error"); return }

  const code2FA = document.getElementById("buy2FA").value.trim()
  if (!code2FA) { showToast("Enter your 2FA code", "error"); return }

  const privKey = Session.getPrivKey(userId)
  if (!privKey) { showToast("Private key missing — go to Settings", "error"); return }

  const amount    = packQty * 10000
  const signature = Crypto.sign(userId, "SYSTEM_THREADS", amount, "buy_threads", privKey)

  const btn = document.getElementById("btnBuyThreads")
  btn.disabled = true
  btn.textContent = "Processing..."

  // Pour l'instant c'est simulé — à connecter au serveur quand la route sera prête
  // const data = await API.buyThreads(userId, packQty, signature, code2FA)

  // SIMULATION
  await new Promise(r => setTimeout(r, 1000))
  const data = { success: true }

  btn.disabled = false
  btn.textContent = "Buy Threads"

  const result = document.getElementById("buyResult")
  result.classList.remove("hidden", "success", "error")

  if (data.success) {
    result.classList.add("success")
    result.textContent = "✓ +" + (packQty * 25) + " threads unlocked!"
    document.getElementById("buy2FA").value = ""
    packQty = 0
    updatePackUI()
    showToast("Threads purchased!", "success")
    await init()
  } else {
    result.classList.add("error")
    result.textContent = "✗ " + (data.error || "Error")
    showToast(data.error || "Error", "error")
  }
})

// ===== LOGOUT =====
document.getElementById("btnLogout").addEventListener("click", function() {
  Session.clear()
  window.location.href = "login.html"
})

init()
