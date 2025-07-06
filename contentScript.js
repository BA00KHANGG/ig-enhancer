// Settings and state management
let currentSettings = {
  autoDetection: false,
  hideComments: true,
  scrollNavigation: true,
  videoControls: false,
  lastScreenMode: "landscape",
}

let scrollTimeout = null
let isScrolling = false
let lastScrollTime = 0
let resizeTimeout = null
const SCROLL_DELAY = 150
const RESIZE_DELAY = 300

// Video controls specific variables
const knownVideoElements = new Set()
let videoObserver = null

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

    // Initialize video controls if enabled
    if (currentSettings.videoControls) {
      initializeVideoControls()
    }
  })
}

function loadSettings(callback) {
  const defaultSettings = {
    autoDetection: false,
    hideComments: true,
    scrollNavigation: true,
    videoControls: false,
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
    // Also listen for screen orientation changes
    window.addEventListener("orientationchange", handleResize)
    // And for when window moves between screens
    window.addEventListener("focus", handleResize)
  } else {
    window.removeEventListener("resize", handleResize)
    window.removeEventListener("orientationchange", handleResize)
    window.removeEventListener("focus", handleResize)
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

  // Always update settings and send status update, even if mode hasn't changed
  // This ensures the popup shows the correct current state
  currentSettings.lastScreenMode = newScreenMode
  saveSettings({ lastScreenMode: newScreenMode })

  if (currentSettings.autoDetection) {
    // Auto hide comments in portrait, show in landscape
    const shouldHideComments = isPortrait
    updateCommentsVisibility(shouldHideComments)
  }

  // Always send status update to popup to ensure it's current
  sendStatusUpdate()
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

// Video Controls Functionality
function initializeVideoControls() {
  if (!currentSettings.videoControls) return

  addVideoControlsCSS()
  modifyAllPresentVideos()
  setupVideoMutationObserver()
}

function addVideoControlsCSS() {
  const styleId = "ig-enhancer-video-controls"

  if (document.getElementById(styleId)) return

  const style = document.createElement("style")
  style.id = styleId
  style.textContent = `
    /* Override Instagram's hiding of native video controls */
    video[data-ig-enhancer-controls="true"]::-webkit-media-controls {
      display: flex !important;
    }
    
    /* Ensure controls are visible */
    video[data-ig-enhancer-controls="true"]::-webkit-media-controls-panel {
      display: flex !important;
    }
    
    /* Make overlays transparent to clicks when video controls are enabled */
    video[data-ig-enhancer-controls="true"] + div {
      pointer-events: none;
    }
    
    /* Restore pointer events for buttons within overlays */
    video[data-ig-enhancer-controls="true"] + div button {
      pointer-events: auto;
    }
  `

  document.head.appendChild(style)
}

function removeVideoControlsCSS() {
  const styleElement = document.getElementById("ig-enhancer-video-controls")
  if (styleElement) {
    styleElement.remove()
  }
}

function getVideos(contextNode = document) {
  return Array.from(contextNode.querySelectorAll("video"))
}

function modifyVideo(video) {
  if (!currentSettings.videoControls) return

  if (videoControlsAlreadyInitialized(video)) return

  // Mark video as processed
  video.dataset.igEnhancerControls = "true"
  knownVideoElements.add(video)

  // Enable native controls
  video.controls = true

  // Clear controlsList to remove restrictions (like hiding download)
  video.setAttribute("controlsList", "")

  // Hide Instagram's custom overlays that interfere with controls
  hideVideoOverlays(video)
}

function videoControlsAlreadyInitialized(video) {
  return video.dataset.igEnhancerControls === "true"
}

function hideVideoOverlays(video) {
  // Find and hide Instagram's custom video overlays
  const parent = video.parentElement
  if (!parent) return

  // Hide overlays that prevent clicks from reaching video controls
  const overlays = parent.querySelectorAll('div[style*="position: absolute"]')
  overlays.forEach(overlay => {
    const rect = overlay.getBoundingClientRect()
    const videoRect = video.getBoundingClientRect()

    // If overlay covers most of the video, make it transparent to clicks
    if (
      rect.width > videoRect.width * 0.8 &&
      rect.height > videoRect.height * 0.8
    ) {
      overlay.style.pointerEvents = "none"

      // But restore pointer events for buttons within the overlay
      const buttons = overlay.querySelectorAll('button, [role="button"]')
      buttons.forEach(button => {
        button.style.pointerEvents = "auto"
      })
    }
  })

  // Also look for specific Instagram overlay classes
  const knownOverlaySelectors = [
    ".videoSpritePlayButton",
    '[aria-label="Play"]',
    '[aria-label="Control"]',
  ]

  knownOverlaySelectors.forEach(selector => {
    const elements = parent.querySelectorAll(selector)
    elements.forEach(element => {
      const overlay = element.closest("div")
      if (overlay && overlay !== video) {
        overlay.style.pointerEvents = "none"
      }
    })
  })
}

function modifyAllPresentVideos() {
  if (!currentSettings.videoControls) return

  getVideos().forEach(modifyVideo)
}

function removeVideoControls(video) {
  if (!videoControlsAlreadyInitialized(video)) return

  // Remove our modifications
  delete video.dataset.igEnhancerControls
  knownVideoElements.delete(video)

  // Disable native controls
  video.controls = false

  // Restore Instagram's controlsList
  video.setAttribute("controlsList", "nodownload")

  // Restore overlay pointer events
  const parent = video.parentElement
  if (parent) {
    const overlays = parent.querySelectorAll(
      'div[style*="pointer-events: none"]'
    )
    overlays.forEach(overlay => {
      overlay.style.pointerEvents = ""
    })
  }
}

function removeAllVideoControls() {
  knownVideoElements.forEach(video => {
    if (document.contains(video)) {
      removeVideoControls(video)
    }
  })
  knownVideoElements.clear()
}

function setupVideoMutationObserver() {
  if (videoObserver) return

  videoObserver = new MutationObserver(mutations => {
    if (!currentSettings.videoControls) return

    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          // Element node
          if (node.tagName === "VIDEO") {
            modifyVideo(node)
          } else if (node.querySelectorAll) {
            // Check for videos in added subtrees
            const videos = node.querySelectorAll("video")
            videos.forEach(modifyVideo)
          }
        }
      })
    })
  })

  videoObserver.observe(document.body, {
    childList: true,
    subtree: true,
  })
}

function disconnectVideoObserver() {
  if (videoObserver) {
    videoObserver.disconnect()
    videoObserver = null
  }
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

  // Update video controls if enabled
  if (currentSettings.videoControls) {
    setTimeout(modifyAllPresentVideos, 100)
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

    case "videoControlsChanged":
      currentSettings.videoControls = message.enabled
      saveSettings({ videoControls: message.enabled })

      if (message.enabled) {
        initializeVideoControls()
      } else {
        removeAllVideoControls()
        removeVideoControlsCSS()
        disconnectVideoObserver()
      }

      sendResponse({ status: "Video controls updated" })
      break

    case "getStatus":
      // Force a fresh screen mode detection when popup requests status
      if (currentSettings.autoDetection) {
        detectScreenMode()
      }
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
  window.removeEventListener("orientationchange", handleResize)
  window.removeEventListener("focus", handleResize)
  disconnectVideoObserver()
})
