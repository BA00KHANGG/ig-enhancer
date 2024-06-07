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

// Function to handle the visibility of comments when the URL changes
function handleUrlChange() {
  const urlPath = window.location.pathname
  if (urlPath.includes("/p/") || urlPath.includes("/reel/")) {
    chrome.storage.local.get({ enabled: true }, data => {
      updateCommentsVisibility(data.enabled)
    })
  }
}

// Observe changes in the DOM to detect when the modal is opened
const observer = new MutationObserver(mutations => {
  mutations.forEach(mutation => {
    if (mutation.addedNodes.length || mutation.removedNodes.length) {
      handleUrlChange()
    }
  })
})

observer.observe(document.body, {
  childList: true,
  subtree: true,
})

// Initial call to handle the current URL
handleUrlChange()

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.enabled !== undefined) {
    updateCommentsVisibility(message.enabled)
    sendResponse({ status: "Done" })
  }
  return true
})
