// ===== AUTH CHECK =====
if (!Session.isLoggedIn()) {
  window.location.href = "login.html"
}

const user    = Session.getUser()
const userId  = user?.id
let privKey   = userId ? Session.getPrivKey(userId) : null
let userPubKey = null
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

// ===== TRUST ARC =====
function setTrust(value) {
  var arc = document.getElementById("trustArc")
  if (!arc) return
  arc.style.strokeDashoffset = 213.6 - (value / 100) * 213.6
  document.getElementById("trustValue").textContent = value
}

// ===== PRICE CHART =====
var chart = null

function initChart() {
  var ctx = document.getElementById("priceChart").getContext("2d")
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
  chart.data.labels = priceHistory.map(function(_, i) { return i })
  chart.data.datasets[0].data = priceHistory
  chart.update()
}

// ===== LOAD DATA =====
async function loadBalance() {
  if (!userId) return
  var results = await Promise.all([API.getUser(userId), API.getPrice()])
  var data  = results[0]
  var price = results[1]

  if (!data || data.error) return

  // Sauvegarder la pubKey récupérée depuis le serveur
  userPubKey = data.pubKey

  document.getElementById("walletBalance").textContent = data.balance

  if (price) {
    var valEUR = (data.balance * price.EUR).toFixed(2)
    var valUSD = (data.balance * price.USD).toFixed(2)
    document.getElementById("walletFiat").textContent = "≈ " + valEUR + " € / " + valUSD + " $"
    document.getElementById("priceEUR").textContent   = price.EUR + " €"
    document.getElementById("priceUSD").textContent   = price.USD + " $"
    document.getElementById("priceMeta").textContent  = "Volume: " + price.volume + " ARC · " + price.transactions + " txs"
    updateChart(price.EUR)
  }

  setTrust(data.trust)
}

async function loadHistory() {
  var data = await API.getLedger()
  var list = document.getElementById("historyList")
  if (!data || !data.transactions) {
    list.innerHTML = '<div class="empty-state">Unable to load</div>'
    return
  }

  var txs = data.transactions
    .filter(function(tx) { return tx.SENDER.ID === userId || tx.RECEIVER.ID === userId })
    .reverse()

  if (txs.length === 0) {
    list.innerHTML = '<div class="empty-state">No transactions yet</div>'
    return
  }

  list.innerHTML = txs.map(function(tx) {
    var isSender   = tx.SENDER.ID === userId
    var otherParty = isSender ? tx.RECEIVER.ID : tx.SENDER.ID
    var amtColor   = isSender ? "color:var(--danger)" : "color:var(--success)"
    var amtSign    = isSender ? "−" : "+"

    return '<div class="tx-item">' +
      '<div class="tx-row">' +
        '<span>' + (isSender
          ? '<span class="tx-from">' + userId + '</span> → <span class="tx-to">' + otherParty + '</span>'
          : '<span class="tx-from">' + otherParty + '</span> → <span class="tx-to">' + userId + '</span>'
        ) + '</span>' +
        '<span class="tx-amt" style="' + amtColor + '">' + amtSign + tx.SENDER.QUANTITY + ' ARC</span>' +
      '</div>' +
      (tx.SENDER.NOTE ? '<div class="tx-note">' + tx.SENDER.NOTE + '</div>' : '') +
      '<div class="tx-row" style="margin-top:0.3rem">' +
        '<span class="tx-time">' + tx.WHEN + ' ' + tx.TIME + '</span>' +
        '<span class="tx-status ' + tx.STATUS + '">' + tx.STATUS.toUpperCase() + '</span>' +
      '</div>' +
    '</div>'
  }).join("")
}

// ===== SEND =====
document.getElementById("btnSend").addEventListener("click", async function() {
  if (!privKey) {
    showToast("Private key missing — go to Settings to add it", "error")
    return
  }

  if (!userPubKey) {
    showToast("Loading account data, please wait...", "info")
    return
  }

  var receiverId = document.getElementById("sendReceiver").value.trim()
  var amount     = parseInt(document.getElementById("sendAmount").value)
  var note       = document.getElementById("sendNote").value.trim()
  var token2FA   = document.getElementById("send2FA").value.trim()

  if (!receiverId)            { showToast("Enter a recipient", "error"); return }
  if (!amount || amount <= 0) { showToast("Invalid amount", "error"); return }
  if (!token2FA)              { showToast("Enter your 2FA code", "error"); return }

  var signature = Crypto.sign(userId, receiverId, amount, note, privKey)

  var btn = document.getElementById("btnSend")
  btn.disabled = true
  btn.textContent = "Sending..."

  var data = await API.send(userId, receiverId, amount, note, signature, token2FA, userPubKey)

  btn.disabled = false
  btn.textContent = "Send →"

  var result = document.getElementById("sendResult")
  result.classList.remove("hidden", "success", "error")

  if (data && data.success) {
    result.classList.add("success")
    result.textContent = "✓ " + userId + " → " + receiverId + " : " + amount + " ARC confirmed"
    document.getElementById("send2FA").value = ""
    await loadBalance()
    await loadHistory()
    showToast("Transaction sent!", "success")
  } else {
    result.classList.add("error")
    result.textContent = "✗ " + (data ? data.error || "Server error" : "Server error")
    showToast(data ? data.error || "Error" : "Error", "error")
  }
})

// ===== RECEIVE =====
document.getElementById("btnCopyId").addEventListener("click", function() {
  navigator.clipboard.writeText(userId || "")
  showToast("Username copied!", "success")
})
document.getElementById("receiveId").addEventListener("click", function() {
  navigator.clipboard.writeText(userId || "")
  showToast("Username copied!", "success")
})

// ===== REFRESH =====
document.getElementById("btnRefreshHistory").addEventListener("click", loadHistory)

// ===== LOGOUT =====
document.getElementById("btnLogout").addEventListener("click", function() {
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
  setInterval(async function() {
    await loadBalance()
    checkServerStatus()
  }, 60000)
}

init()
