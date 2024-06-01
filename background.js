chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ enabled: true }) // Set default state to enabled
  updateIconBasedOnDomain()
})

chrome.runtime.onStartup.addListener(() => {
  updateIconBasedOnDomain() // Ensure correct icon on browser startup for all tabs
})

chrome.action.onClicked.addListener(tab => {
  chrome.storage.local.get({ enabled: true }, data => {
    const newState = !data.enabled
    chrome.storage.local.set({ enabled: newState }, () => {
      sendMessageWithRetry(tab.id, { enabled: newState })
      updateIconForTab(tab) // Update icon based on the new state and tab URL
    })
  })
})

function sendMessageWithRetry(tabId, message, retryCount = 0) {
  chrome.tabs.sendMessage(tabId, message, response => {
    if (chrome.runtime.lastError) {
      if (retryCount < 3) {
        setTimeout(
          () => sendMessageWithRetry(tabId, message, retryCount + 1),
          1000
        )
      } else {
        console.error(
          "Failed to send message after retries:",
          chrome.runtime.lastError.message
        )
      }
      return
    }
  })
}

function updateIconForTab(tab) {
  chrome.storage.local.get({ enabled: true }, data => {
    const iconPath = tab.url.includes("Instagram.com")
      ? data.enabled
        ? "icon-enabled.png"
        : "icon-disabled.png"
      : "icon-disabled.png"
    chrome.action.setIcon({ path: iconPath, tabId: tab.id })
  })
}

function updateIconBasedOnDomain() {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      updateIconForTab(tab)
    })
  })
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateIconForTab(tab)
  }
})
