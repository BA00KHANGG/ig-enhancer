let scrollTimeout = null
let isScrolling = false
let lastScrollTime = 0
const SCROLL_DELAY = 150 // Minimum time between scroll actions

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

// Function to find navigation buttons
function findNavigationButtons() {
  // Look for the navigation container and buttons
  const navButtons = document.querySelectorAll('button[type="button"]')
  let prevButton = null
  let nextButton = null

  navButtons.forEach(button => {
    const svg = button.querySelector("svg")
    if (svg) {
      const ariaLabel = svg.getAttribute("aria-label")
      const title = svg.querySelector("title")?.textContent

      // Check for "Go back" or previous indicators
      if (ariaLabel === "Go back" || title === "Go back") {
        prevButton = button
      }
      // Check for "Next" indicators
      else if (ariaLabel === "Next" || title === "Next") {
        nextButton = button
      }
    }
  })

  return { prevButton, nextButton }
}

// Function to navigate posts/reels
function navigatePost(direction) {
  const currentTime = Date.now()

  // Prevent rapid scrolling
  if (currentTime - lastScrollTime < SCROLL_DELAY) {
    return
  }

  lastScrollTime = currentTime

  const { prevButton, nextButton } = findNavigationButtons()

  if (direction === "next" && nextButton) {
    // Check if button is enabled (not disabled)
    if (!nextButton.disabled && nextButton.offsetParent !== null) {
      nextButton.click()
    }
  } else if (direction === "prev" && prevButton) {
    // Check if button is enabled (not disabled)
    if (!prevButton.disabled && prevButton.offsetParent !== null) {
      prevButton.click()
    }
  }
}

// Function to handle wheel events
function handleWheelEvent(event) {
  // Only handle if we're in a post/reel modal
  if (!isInPostModal()) {
    return
  }

  // Prevent default scrolling behavior
  event.preventDefault()
  event.stopPropagation()

  if (isScrolling) {
    return
  }

  isScrolling = true

  // Determine scroll direction
  const deltaY = event.deltaY

  if (deltaY > 0) {
    // Scrolling down - go to next post
    navigatePost("next")
  } else if (deltaY < 0) {
    // Scrolling up - go to previous post
    navigatePost("prev")
  }

  // Reset scrolling flag after delay
  setTimeout(() => {
    isScrolling = false
  }, SCROLL_DELAY)
}

// Function to check if we're in a post/reel modal
function isInPostModal() {
  const urlPath = window.location.pathname
  const hasModal =
    document.querySelector('article[role="presentation"]') !== null

  // Check if we're on a user page with a post open, or in reels
  return (
    hasModal &&
    (urlPath.includes("/p/") ||
      urlPath.includes("/reel/") ||
      urlPath.match(/^\/[^\/]+\//))
  )
}

// Function to add scroll listeners
function addScrollListeners() {
  // Remove existing listeners first
  removeScrollListeners()

  // Add wheel event listener with passive: false to allow preventDefault
  document.addEventListener("wheel", handleWheelEvent, {
    passive: false,
    capture: true,
  })
}

// Function to remove scroll listeners
function removeScrollListeners() {
  document.removeEventListener("wheel", handleWheelEvent, { capture: true })
}

// Function to handle the visibility of comments when the URL changes
function handleUrlChange() {
  const urlPath = window.location.pathname
  if (urlPath.includes("/p/") || urlPath.includes("/reel/")) {
    chrome.storage.local.get({ enabled: true }, data => {
      updateCommentsVisibility(data.enabled)
    })
  }
}

// Enhanced observer to handle modal changes and add scroll functionality
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    mutation.addedNodes.forEach(node => {
      if (node.nodeType === 1 && node.matches('article[role="presentation"]')) {
        handleUrlChange()
        // Add scroll listeners when a post modal is opened
        setTimeout(addScrollListeners, 100) // Small delay to ensure DOM is ready
      }
    })

    // Check for removed nodes (modal closed)
    mutation.removedNodes.forEach(node => {
      if (
        node.nodeType === 1 &&
        node.matches &&
        node.matches('article[role="presentation"]')
      ) {
        // Remove scroll listeners when modal is closed
        removeScrollListeners()
      }
    })
  })
})

observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// Handle URL changes (for SPA navigation)
let currentUrl = window.location.href
setInterval(() => {
  if (currentUrl !== window.location.href) {
    currentUrl = window.location.href

    if (isInPostModal()) {
      setTimeout(addScrollListeners, 100)
    } else {
      removeScrollListeners()
    }

    handleUrlChange()
  }
}, 500)

// Initial setup
setTimeout(() => {
  handleUrlChange()
  if (isInPostModal()) {
    addScrollListeners()
  }
}, 1000)

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.enabled !== undefined) {
    updateCommentsVisibility(message.enabled)
    sendResponse({ status: "Done" })
  }
  return true
})

// Cleanup on page unload
window.addEventListener("beforeunload", () => {
  removeScrollListeners()
})
