// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  const defaultSettings = {
    autoDetection: false,
    hideComments: true,
    scrollNavigation: true,
    lastScreenMode: "landscape",
  }

  chrome.storage.local.set(defaultSettings)
  updateIconBasedOnDomain()
})

chrome.runtime.onStartup.addListener(() => {
  updateIconBasedOnDomain()
})

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(command => {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const activeTab = tabs[0]

    // Only work on Instagram pages
    if (!activeTab || !activeTab.url.includes("instagram.com")) {
      return
    }

    switch (command) {
      case "toggle-auto-detection":
        toggleAutoDetection(activeTab)
        break
      case "toggle-hide-comments":
        toggleHideComments(activeTab)
        break
      case "toggle-scroll-navigation":
        toggleScrollNavigation(activeTab)
        break
    }
  })
})

function toggleAutoDetection(tab) {
  chrome.storage.local.get({ autoDetection: false }, data => {
    const newState = !data.autoDetection
    chrome.storage.local.set({ autoDetection: newState }, () => {
      sendMessageWithRetry(tab.id, {
        type: "autoDetectionChanged",
        enabled: newState,
      })
      updateIconForTab(tab)
    })
  })
}

function toggleHideComments(tab) {
  chrome.storage.local.get(
    { hideComments: true, autoDetection: false },
    data => {
      // Only toggle if auto detection is off
      if (!data.autoDetection) {
        const newState = !data.hideComments
        chrome.storage.local.set({ hideComments: newState }, () => {
          sendMessageWithRetry(tab.id, {
            type: "hideCommentsChanged",
            enabled: newState,
          })
          updateIconForTab(tab)
        })
      }
    }
  )
}

function toggleScrollNavigation(tab) {
  chrome.storage.local.get({ scrollNavigation: true }, data => {
    const newState = !data.scrollNavigation
    chrome.storage.local.set({ scrollNavigation: newState }, () => {
      sendMessageWithRetry(tab.id, {
        type: "scrollNavigationChanged",
        enabled: newState,
      })
      updateIconForTab(tab)
    })
  })
}

// Handle action clicks (when popup is not available or for quick toggle)
chrome.action.onClicked.addListener(tab => {
  // This will only trigger if popup is not set or fails to load
  // Provides fallback functionality for quick comment toggle
  chrome.storage.local.get(
    { hideComments: true, autoDetection: false },
    data => {
      // Only toggle if auto detection is off
      if (!data.autoDetection) {
        const newState = !data.hideComments
        chrome.storage.local.set({ hideComments: newState }, () => {
          sendMessageWithRetry(tab.id, {
            type: "hideCommentsChanged",
            enabled: newState,
          })
          updateIconForTab(tab)
        })
      }
    }
  )
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
  chrome.storage.local.get(
    {
      hideComments: true,
      autoDetection: false,
      scrollNavigation: true,
      lastScreenMode: "landscape",
    },
    data => {
      let iconPath = "icons/icon-disabled.png"

      if (tab.url && tab.url.includes("instagram.com")) {
        // Show enabled icon if ANY feature is active
        const hasActiveFeatures =
          data.autoDetection ||
          data.scrollNavigation ||
          (!data.autoDetection && data.hideComments)

        iconPath = hasActiveFeatures
          ? "icons/icon-enabled.png"
          : "icons/icon-disabled.png"
      }

      chrome.action.setIcon({ path: iconPath, tabId: tab.id })
    }
  )
}

function updateIconBasedOnDomain() {
  chrome.tabs.query({}, tabs => {
    tabs.forEach(tab => {
      updateIconForTab(tab)
    })
  })
}

// Update icon when tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    updateIconForTab(tab)
  }
})

// Listen for storage changes to update icons
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    // Update icons when any setting changes
    if (
      changes.hideComments ||
      changes.autoDetection ||
      changes.scrollNavigation ||
      changes.lastScreenMode
    ) {
      updateIconBasedOnDomain()
    }
  }
})

// Handle messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "statusUpdate") {
    // Forward status updates if needed
    sendResponse({ status: "Status received" })
  }

  return true
})
