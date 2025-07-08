// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  // Set default settings
  const defaultSettings = {
    autoDetection: true,
    hideComments: true,
    scrollNavigation: true,
    videoControls: true,
    tikTokSidebar: true,
    lastScreenMode: "landscape",
    commentOverride: null, // null = no override, true = force hide, false = force show
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
        toggleHideCommentsWithOverride(activeTab)
        break
      case "toggle-scroll-navigation":
        toggleScrollNavigation(activeTab)
        break
      case "toggle-video-controls":
        toggleVideoControls(activeTab)
        break
      case "toggle-tiktok-sidebar":
        toggleTikTokSidebar(activeTab)
        break
    }
  })
})

function toggleAutoDetection(tab) {
  chrome.storage.local.get({ autoDetection: true }, data => {
    const newState = !data.autoDetection
    chrome.storage.local.set(
      {
        autoDetection: newState,
        // Clear any comment override when toggling auto detection
        commentOverride: null,
      },
      () => {
        sendMessageWithRetry(tab.id, {
          type: "autoDetectionChanged",
          enabled: newState,
        })
        updateIconForTab(tab)
      }
    )
  })
}

function toggleHideCommentsWithOverride(tab) {
  chrome.storage.local.get(
    {
      hideComments: true,
      autoDetection: true,
      commentOverride: null,
      lastScreenMode: "landscape",
    },
    data => {
      if (data.autoDetection) {
        // When auto detection is enabled, Alt+H works as a temporary override
        let newOverride

        // Determine current effective state (what comments are actually doing)
        const currentlyHidden =
          data.commentOverride !== null
            ? data.commentOverride
            : data.lastScreenMode === "portrait"

        // Toggle the override to opposite of current state
        newOverride = !currentlyHidden

        chrome.storage.local.set({ commentOverride: newOverride }, () => {
          sendMessageWithRetry(tab.id, {
            type: "commentOverrideChanged",
            override: newOverride,
          })
          updateIconForTab(tab)
        })
      } else {
        // When auto detection is off, work normally
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

function toggleVideoControls(tab) {
  chrome.storage.local.get({ videoControls: true }, data => {
    const newState = !data.videoControls
    chrome.storage.local.set({ videoControls: newState }, () => {
      sendMessageWithRetry(tab.id, {
        type: "videoControlsChanged",
        enabled: newState,
      })
      updateIconForTab(tab)
    })
  })
}

function toggleTikTokSidebar(tab) {
  chrome.storage.local.get({ tikTokSidebar: true }, data => {
    const newState = !data.tikTokSidebar
    chrome.storage.local.set({ tikTokSidebar: newState }, () => {
      sendMessageWithRetry(tab.id, {
        type: "tikTokSidebarChanged",
        enabled: newState,
      })
      updateIconForTab(tab)
    })
  })
}

// Handle action clicks (when popup is not available or for quick toggle)
chrome.action.onClicked.addListener(tab => {
  chrome.storage.local.get(
    {
      hideComments: true,
      autoDetection: true,
      commentOverride: null,
      lastScreenMode: "landscape",
    },
    data => {
      if (data.autoDetection) {
        // Apply override when auto detection is on
        const currentlyHidden =
          data.commentOverride !== null
            ? data.commentOverride
            : data.lastScreenMode === "portrait"

        const newOverride = !currentlyHidden

        chrome.storage.local.set({ commentOverride: newOverride }, () => {
          sendMessageWithRetry(tab.id, {
            type: "commentOverrideChanged",
            override: newOverride,
          })
          updateIconForTab(tab)
        })
      } else {
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
      autoDetection: true,
      scrollNavigation: true,
      videoControls: true,
      tikTokSidebar: true,
      lastScreenMode: "landscape",
      commentOverride: null,
    },
    data => {
      let iconPath = "icon.png"

      if (tab.url && tab.url.includes("instagram.com")) {
        // Show enabled icon if ANY feature is active
        const hasActiveFeatures =
          data.autoDetection ||
          data.scrollNavigation ||
          data.videoControls ||
          data.tikTokSidebar ||
          (!data.autoDetection && data.hideComments) ||
          data.commentOverride !== null

        iconPath = hasActiveFeatures ? "icon.png" : "icon.png"
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
      changes.videoControls ||
      changes.tikTokSidebar ||
      changes.lastScreenMode ||
      changes.commentOverride
    ) {
      updateIconBasedOnDomain()
    }
  }
})
