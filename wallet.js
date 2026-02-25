// ===== AUTH CHECK =====
if (!Session.isLoggedIn()) {
  window.location.href = "login.html"
}

const user   = Session.getUser()
const userId = user?.id
let privKey  = userId ? Session.getPrivKey(userId) : null
let priceHistory = []

// ===== INIT UI =====
if (userId) {
  document.getElementById("walletUser").textContent = userId
  document.getElementById("receiveId").textContent  = userId
  new QRCode(document.getElementById("receiveQR"), {
    text: userId, width: 120, height: 120,
    colorDark: "#000", colorLight: "#fff"
  })
}

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

// ===== TRUST ARC =====
function setTrust(value) {
  const arc = document.getElementById("trustArc")
  if (!arc) return
  arc.style.strokeDashoffset = 213.6 - (value / 100) * 213.6
  document.getElementById("trustValue").textContent = value
}

// ===== PRICE CHART =====
let chart = null

function initChart() {
  const ctx = document.getElementById("priceChart").getContext("2d")
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: "rgba(167,139,250,0.8)",
        backgroundColor: "rgba(167,139,250,0.05)",
        borderWidth: 1.5,
        pointRadius: 0,
        fill: true,
        tension: 0.4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { enabled: false } },
      scales: { x: { display: false }, y: { display: false } },
      animation: { duration: 300 }
    }
  })
}

function updateChart(price) {
  if (!chart) return
  priceHistory.push(price)
  if (priceHistory.length > 20) priceHistory.shift()
  chart.data.labels = priceHistory.map((_, i) => i)
  chart.data.datasets[0].data = priceHistory
  chart.update()
}

// ===== LOAD DATA =====
async function loadBalance() {
  if (!userId) return
  const [data, price] = await Promise.all([API.getUser(userId), API.getPrice()])
  if (!data || data.error) return

  document.getElementById("walletBalance").textContent = data.balance

  if (price) {
    const valEUR = (data.balance * price.EUR).toFixed(2)
    const valUSD = (data.balance * price.USD).toFixed(2)
    document.getElementById("walletFiat").textContent = `≈ ${valEUR} € / ${valUSD} $`
    document.getElementById("priceEUR").textContent   = `${price.EUR} €`
    document.getElementById("priceUSD").textContent   = `${price.USD} $`
    document.getElementById("priceMeta").textContent  = `Volume: ${price.volume} ARC · ${price.transactions} txs`
    updateChart(price.EUR)
  }

  setTrust(data.trust)
}

async function loadHistory() {
  const data = await API.getLedger()
  const list = document.getElementById("historyList")
  if (!data || !data.transactions) {
    list.innerHTML = '<div class="empty-state">Unable to load</div>'
    return
  }

  // Filtrer seulement les transactions de l'utilisateur connecté
  const txs = [...data.transactions]
    .filter(tx => tx.SENDER.ID === userId || tx.RECEIVER.ID === userId)
    .reverse()

  if (txs.length === 0) {
    list.innerHTML = '<div class="empty-state">No transactions yet</div>'
    return
  }

  list.innerHTML = txs.map(tx => {
    const isSender   = tx.SENDER.ID === userId
    const otherParty = isSender ? tx.RECEIVER.ID : tx.SENDER.ID
    const amtColor   = isSender ? "style='color:var(--danger)'" : "style='color:var(--success)'"
    const amtSign    = isSender ? "−" : "+"

    return `
      <div class="tx-item">
        <div class="tx-row">
          <span>${isSender
            ? `<span class="tx-from">${userId}</span> → <span class="tx-to">${otherParty}</span>`
            : `<span class="tx-from">${otherParty}</span> → <span class="tx-to">${userId}</span>`
          }</span>
          <span class="tx-amt" ${amtColor}>${amtSign}${tx.SENDER.QUANTITY} ARC</span>
        </div>
        ${tx.SENDER.NOTE ? `<div class="tx-note">${tx.SENDER.NOTE}</div>` : ""}
        <div class="tx-row" style="margin-top:0.3rem">
          <span class="tx-time">${tx.WHEN} ${tx.TIME}</span>
          <span class="tx-status ${tx.STATUS}">${tx.STATUS.toUpperCase()}</span>
        </div>
      </div>
    `
  }).join("")
}

// ===== SEND =====
document.getElementById("btnSend").addEventListener("click", async () => {
  if (!privKey) {
    showToast("Private key missing — go to Settings to add it", "error")
    return
  }

  const receiverId = document.getElementById("sendReceiver").value.trim()
  const amount     = parseInt(document.getElementById("sendAmount").value)
  const note       = document.getElementById("sendNote").value.trim()
  const token2FA   = document.getElementById("send2FA").value.trim()

  if (!receiverId)            { showToast("Enter a recipient", "error"); return }
  if (!amount || amount <= 0) { showToast("Invalid amount", "error"); return }
  if (!token2FA)              { showToast("Enter your 2FA code", "error"); return }

  const signature = Crypto.sign(userId, receiverId, amount, note, privKey)

  const btn = document.getElementById("btnSend")
  btn.disabled = true
  btn.textContent = "Sending..."

  const data = await API.send(userId, receiverId, amount, note, signature, token2FA, user.pubKey)

  btn.disabled = false
  btn.textContent = "Send →"

  const result = document.getElementById("sendResult")
  result.classList.remove("hidden", "success", "error")

  if (data?.success) {
    result.classList.add("success")
    result.textContent = `✓ ${userId} → ${receiverId} : ${amount} ARC confirmed`
    document.getElementById("send2FA").value = ""
    await loadBalance()
    await loadHistory()
    showToast("Transaction sent!", "success")
  } else {
    result.classList.add("error")
    result.textContent = `✗ ${data?.error || "Server error"}`
    showToast(data?.error || "Error", "error")
  }
})

// ===== RECEIVE =====
document.getElementById("btnCopyId").addEventListener("click", () => {
  navigator.clipboard.writeText(userId || "")
  showToast("Username copied!", "success")
})
document.getElementById("receiveId").addEventListener("click", () => {
  navigator.clipboard.writeText(userId || "")
  showToast("Username copied!", "success")
})

// ===== REFRESH =====
document.getElementById("btnRefreshHistory").addEventListener("click", loadHistory)

// ===== LOGOUT =====
document.getElementById("btnLogout").addEventListener("click", () => {
  Session.clear()
  window.location.href = "login.html"
})

// ===== INIT =====
async function init() {
  checkServerStatus()
  startOTPCountdown()
  initChart()
  await loadBalance()
  await loadHistory()
  setInterval(async () => {
    await loadBalance()
    checkServerStatus()
  }, 60000)
}

init()
