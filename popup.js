// Default settings
const DEFAULT_SETTINGS = {
  autoDetection: false,
  hideComments: true,
  scrollNavigation: true,
  videoControls: false,
  lastScreenMode: "landscape",
  commentOverride: null, // null = no override, true = force hide, false = force show
}

// DOM elements
let autoDetectionToggle,
  hideCommentsToggle,
  scrollNavigationToggle,
  videoControlsToggle
let screenModeStatus, commentsStatus, videoControlsStatus

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  initializeElements()
  loadSettings()
  setupEventListeners()
  updateStatus()
})

function initializeElements() {
  autoDetectionToggle = document.getElementById("autoDetection")
  hideCommentsToggle = document.getElementById("hideComments")
  scrollNavigationToggle = document.getElementById("scrollNavigation")
  videoControlsToggle = document.getElementById("videoControls")
  screenModeStatus = document.getElementById("screenMode")
  commentsStatus = document.getElementById("commentsStatus")
  videoControlsStatus = document.getElementById("videoControlsStatus")
}

function loadSettings() {
  chrome.storage.local.get(DEFAULT_SETTINGS, settings => {
    autoDetectionToggle.checked = settings.autoDetection
    hideCommentsToggle.checked = settings.hideComments
    scrollNavigationToggle.checked = settings.scrollNavigation
    videoControlsToggle.checked = settings.videoControls

    updateHideCommentsState()
    updateStatusDisplay(settings)
  })
}

function setupEventListeners() {
  autoDetectionToggle.addEventListener("change", handleAutoDetectionChange)
  hideCommentsToggle.addEventListener("change", handleHideCommentsChange)
  scrollNavigationToggle.addEventListener(
    "change",
    handleScrollNavigationChange
  )
  videoControlsToggle.addEventListener("change", handleVideoControlsChange)
}

function handleAutoDetectionChange() {
  const enabled = autoDetectionToggle.checked

  updateSetting("autoDetection", enabled)
  // Clear any override when toggling auto detection
  updateSetting("commentOverride", null)
  updateHideCommentsState()

  // Send message to content script
  sendMessageToActiveTab({
    type: "autoDetectionChanged",
    enabled: enabled,
  })

  updateStatus()
}

function handleHideCommentsChange() {
  const enabled = hideCommentsToggle.checked

  updateSetting("hideComments", enabled)

  // Send message to content script
  sendMessageToActiveTab({
    type: "hideCommentsChanged",
    enabled: enabled,
  })

  updateStatus()
}

function handleScrollNavigationChange() {
  const enabled = scrollNavigationToggle.checked

  updateSetting("scrollNavigation", enabled)

  // Send message to content script
  sendMessageToActiveTab({
    type: "scrollNavigationChanged",
    enabled: enabled,
  })

  updateStatus()
}

function handleVideoControlsChange() {
  const enabled = videoControlsToggle.checked

  updateSetting("videoControls", enabled)

  // Send message to content script
  sendMessageToActiveTab({
    type: "videoControlsChanged",
    enabled: enabled,
  })

  updateStatus()
}

function updateHideCommentsState() {
  const autoEnabled = autoDetectionToggle.checked
  const hideCommentsItem = hideCommentsToggle.closest(".setting-item")

  hideCommentsToggle.disabled = autoEnabled

  if (autoEnabled) {
    hideCommentsItem.classList.add("disabled")
  } else {
    hideCommentsItem.classList.remove("disabled")
  }
}

function updateSetting(key, value) {
  chrome.storage.local.set({ [key]: value })
}

function sendMessageToActiveTab(message) {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    if (tabs[0] && tabs[0].url.includes("instagram.com")) {
      chrome.tabs.sendMessage(tabs[0].id, message, response => {
        if (chrome.runtime.lastError) {
          console.log(
            "Message sending failed:",
            chrome.runtime.lastError.message
          )
        }
      })
    }
  })
}

function updateStatus() {
  // Get current settings and update status display
  chrome.storage.local.get(DEFAULT_SETTINGS, settings => {
    updateStatusDisplay(settings)
  })

  // Request current status from content script
  sendMessageToActiveTab({
    type: "getStatus",
  })
}

function getEffectiveCommentState(settings) {
  // Determine what the comments are actually doing
  if (settings.commentOverride !== null) {
    // Override is active
    return {
      hidden: settings.commentOverride,
      reason: settings.commentOverride ? "override-hide" : "override-show",
    }
  }

  if (settings.autoDetection) {
    // Auto detection without override
    const hidden = settings.lastScreenMode === "portrait"
    return {
      hidden: hidden,
      reason: hidden ? "auto-hide" : "auto-show",
    }
  } else {
    // Manual mode
    return {
      hidden: settings.hideComments,
      reason: settings.hideComments ? "manual-hide" : "manual-show",
    }
  }
}

function updateStatusDisplay(settings) {
  // Update screen mode
  const screenMode = settings.lastScreenMode || "landscape"
  screenModeStatus.textContent =
    screenMode.charAt(0).toUpperCase() + screenMode.slice(1)
  screenModeStatus.className = "status-value"

  // Update comments status with enhanced logic
  const commentState = getEffectiveCommentState(settings)
  let commentsText
  let commentsClass

  switch (commentState.reason) {
    case "override-hide":
      commentsText = "Override Hidden"
      commentsClass = "status-value inactive"
      break
    case "override-show":
      commentsText = "Override Shown"
      commentsClass = "status-value active"
      break
    case "auto-hide":
      commentsText = "Auto Hidden"
      commentsClass = "status-value inactive"
      break
    case "auto-show":
      commentsText = "Auto Shown"
      commentsClass = "status-value active"
      break
    case "manual-hide":
      commentsText = "Hidden"
      commentsClass = "status-value inactive"
      break
    case "manual-show":
      commentsText = "Shown"
      commentsClass = "status-value active"
      break
    default:
      commentsText = "Unknown"
      commentsClass = "status-value"
  }

  commentsStatus.textContent = commentsText
  commentsStatus.className = commentsClass

  // Update video controls status
  const videoControlsState = settings.videoControls ? "Enabled" : "Disabled"
  videoControlsStatus.textContent = videoControlsState
  videoControlsStatus.className = `status-value ${
    settings.videoControls ? "active" : "inactive"
  }`
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "statusUpdate") {
    updateStatusDisplay(message.settings)
  }
})

// Listen for storage changes to update popup in real-time
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "local") {
    // Update popup when any setting changes
    chrome.storage.local.get(DEFAULT_SETTINGS, settings => {
      updateStatusDisplay(settings)

      // Also update the toggle states if they changed
      if (changes.autoDetection) {
        autoDetectionToggle.checked = settings.autoDetection
        updateHideCommentsState()
      }
      if (changes.hideComments) {
        hideCommentsToggle.checked = settings.hideComments
      }
      if (changes.scrollNavigation) {
        scrollNavigationToggle.checked = settings.scrollNavigation
      }
      if (changes.videoControls) {
        videoControlsToggle.checked = settings.videoControls
      }
    })
  }
})

// Update status when popup is opened
chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
  if (tabs[0] && tabs[0].url.includes("instagram.com")) {
    // Small delay to ensure content script is ready
    setTimeout(() => {
      sendMessageToActiveTab({
        type: "getStatus",
      })
    }, 100)
  }
})
