// Settings and state management
let currentSettings = {
  autoDetection: false,
  hideComments: true,
  scrollNavigation: true,
  lastScreenMode: "landscape",
}

let scrollTimeout = null
let isScrolling = false
let lastScrollTime = 0
let resizeTimeout = null
const SCROLL_DELAY = 150
const RESIZE_DELAY = 300

// Initialize extension
initializeExtension()

function initializeExtension() {
  loadSettings(() => {
    handleUrlChange()
    setupScreenDetection()
    if (isInPostModal()) {
      addScrollListeners()
    }
    startObserving()
  })
}

function loadSettings(callback) {
  const defaultSettings = {
    autoDetection: false,
    hideComments: true,
    scrollNavigation: true,
    lastScreenMode: "landscape",
  }

  chrome.storage.local.get(defaultSettings, settings => {
    currentSettings = { ...settings }
    if (callback) callback()
  })
}

function saveSettings(updates) {
  currentSettings = { ...currentSettings, ...updates }
  chrome.storage.local.set(updates)
}

// Screen detection functionality
function setupScreenDetection() {
  if (currentSettings.autoDetection) {
    detectScreenMode()
    window.addEventListener("resize", handleResize)
  } else {
    window.removeEventListener("resize", handleResize)
  }
}

function handleResize() {
  if (resizeTimeout) {
    clearTimeout(resizeTimeout)
  }

  resizeTimeout = setTimeout(() => {
    if (currentSettings.autoDetection) {
      detectScreenMode()
    }
  }, RESIZE_DELAY)
}

function detectScreenMode() {
  const width = window.innerWidth
  const height = window.innerHeight
  const aspectRatio = width / height

  // Consider portrait if aspect ratio is less than 1.2 (to account for tablets)
  const isPortrait = aspectRatio < 1.2
  const newScreenMode = isPortrait ? "portrait" : "landscape"

  if (newScreenMode !== currentSettings.lastScreenMode) {
    currentSettings.lastScreenMode = newScreenMode
    saveSettings({ lastScreenMode: newScreenMode })

    if (currentSettings.autoDetection) {
      // Auto hide comments in portrait, show in landscape
      const shouldHideComments = isPortrait
      updateCommentsVisibility(shouldHideComments)
    }

    // Send status update to popup if it's open
    sendStatusUpdate()
  }
}

function updateCommentsVisibility(hide) {
  const styleId = "hide-comments-style"
  let styleElement = document.getElementById(styleId)

  if (hide) {
    if (!styleElement) {
      styleElement = document.createElement("style")
      styleElement.id = styleId
      styleElement.innerText = `
        article[role="presentation"] > div > div:nth-child(2) { 
          display: none !important; 
        }
      `
      document.head.appendChild(styleElement)
    }
  } else {
    if (styleElement) {
      styleElement.remove()
    }
  }
}

function shouldHideComments() {
  if (currentSettings.autoDetection) {
    return currentSettings.lastScreenMode === "portrait"
  } else {
    return currentSettings.hideComments
  }
}

// Scroll navigation functionality (preserved from original)
function findNavigationButtons() {
  const navButtons = document.querySelectorAll('button[type="button"]')
  let prevButton = null
  let nextButton = null

  navButtons.forEach(button => {
    const svg = button.querySelector("svg")
    if (svg) {
      const ariaLabel = svg.getAttribute("aria-label")
      const title = svg.querySelector("title")?.textContent

      if (ariaLabel === "Go back" || title === "Go back") {
        prevButton = button
      } else if (ariaLabel === "Next" || title === "Next") {
        nextButton = button
      }
    }
  })

  return { prevButton, nextButton }
}

function navigatePost(direction) {
  if (!currentSettings.scrollNavigation) return

  const currentTime = Date.now()

  if (currentTime - lastScrollTime < SCROLL_DELAY) {
    return
  }

  lastScrollTime = currentTime

  const { prevButton, nextButton } = findNavigationButtons()

  if (direction === "next" && nextButton) {
    if (!nextButton.disabled && nextButton.offsetParent !== null) {
      nextButton.click()
    }
  } else if (direction === "prev" && prevButton) {
    if (!prevButton.disabled && prevButton.offsetParent !== null) {
      prevButton.click()
    }
  }
}

function handleWheelEvent(event) {
  if (!currentSettings.scrollNavigation || !isInPostModal()) {
    return
  }

  event.preventDefault()
  event.stopPropagation()

  if (isScrolling) {
    return
  }

  isScrolling = true

  const deltaY = event.deltaY

  if (deltaY > 0) {
    navigatePost("next")
  } else if (deltaY < 0) {
    navigatePost("prev")
  }

  setTimeout(() => {
    isScrolling = false
  }, SCROLL_DELAY)
}

function isInPostModal() {
  const urlPath = window.location.pathname
  const hasModal =
    document.querySelector('article[role="presentation"]') !== null

  return (
    hasModal &&
    (urlPath.includes("/p/") ||
      urlPath.includes("/reel/") ||
      urlPath.match(/^\/[^\/]+\//))
  )
}

function addScrollListeners() {
  if (currentSettings.scrollNavigation) {
    removeScrollListeners()
    document.addEventListener("wheel", handleWheelEvent, {
      passive: false,
      capture: true,
    })
  }
}

function removeScrollListeners() {
  document.removeEventListener("wheel", handleWheelEvent, { capture: true })
}

// URL and modal handling
function handleUrlChange() {
  const urlPath = window.location.pathname
  if (urlPath.includes("/p/") || urlPath.includes("/reel/")) {
    updateCommentsVisibility(shouldHideComments())
  }

  // Update screen detection
  if (currentSettings.autoDetection) {
    detectScreenMode()
  }
}

// DOM observation (preserved from original)
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (
        node.nodeType === 1 &&
        node.matches &&
        node.matches('article[role="presentation"]')
      ) {
        handleUrlChange()
        if (currentSettings.scrollNavigation) {
          setTimeout(addScrollListeners, 100)
        }
      }
    })

    mutation.removedNodes.forEach(node => {
      if (
        node.nodeType === 1 &&
        node.matches &&
        node.matches('article[role="presentation"]')
      ) {
        removeScrollListeners()
      }
    })
  })
})

function startObserving() {
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

// URL change detection for SPA
let currentUrl = window.location.href
setInterval(() => {
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href

    if (isInPostModal() && currentSettings.scrollNavigation) {
      setTimeout(addScrollListeners, 100)
    } else {
      removeScrollListeners()
    }

    handleUrlChange()
  }
}, 500)

// Message handling for popup communication
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "autoDetectionChanged":
      currentSettings.autoDetection = message.enabled
      saveSettings({ autoDetection: message.enabled })
      setupScreenDetection()

      if (message.enabled) {
        detectScreenMode()
      } else {
        // When auto detection is disabled, use manual setting
        updateCommentsVisibility(currentSettings.hideComments)
      }

      sendResponse({ status: "Auto detection updated" })
      break

    case "hideCommentsChanged":
      currentSettings.hideComments = message.enabled
      saveSettings({ hideComments: message.enabled })

      // Only apply manual setting if auto detection is off
      if (!currentSettings.autoDetection) {
        updateCommentsVisibility(message.enabled)
      }

      sendResponse({ status: "Hide comments updated" })
      break

    case "scrollNavigationChanged":
      currentSettings.scrollNavigation = message.enabled
      saveSettings({ scrollNavigation: message.enabled })

      if (message.enabled && isInPostModal()) {
        addScrollListeners()
      } else {
        removeScrollListeners()
      }

      sendResponse({ status: "Scroll navigation updated" })
      break

    case "getStatus":
      sendStatusUpdate()
      sendResponse({ status: "Status sent" })
      break

    // Legacy support for old background script
    case undefined:
      if (message.enabled !== undefined) {
        currentSettings.hideComments = message.enabled
        saveSettings({ hideComments: message.enabled })

        if (!currentSettings.autoDetection) {
          updateCommentsVisibility(message.enabled)
        }

        sendResponse({ status: "Done" })
      }
      break

    default:
      sendResponse({ status: "Unknown message type" })
  }

  return true
})

function sendStatusUpdate() {
  try {
    chrome.runtime.sendMessage({
      type: "statusUpdate",
      settings: currentSettings,
    })
  } catch (error) {
    // Extension context may be invalid, ignore
  }
}

// Cleanup
window.addEventListener("beforeunload", () => {
  removeScrollListeners()
  window.removeEventListener("resize", handleResize)
})
