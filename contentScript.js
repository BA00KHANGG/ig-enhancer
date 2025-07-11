// Settings and state management
let currentSettings = {
  autoDetection: true,
  hideComments: true,
  scrollNavigation: true,
  videoControls: true,
  tikTokSidebar: true, // New setting for TikTok-style sidebar
  lastScreenMode: "landscape",
  commentOverride: null, // null = no override, true = force hide, false = force show
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

// TikTok sidebar specific variables
let sidebarElement = null
let sidebarObserver = null

// Initialize extension
initializeExtension()

function initializeExtension() {
  loadSettings(() => {
    handleUrlChange()
    setupScreenDetection()

    // Only initialize features if we're in a post modal
    if (isInPostModal()) {
      addScrollListeners()

      if (currentSettings.tikTokSidebar) {
        // Add extra delay for initial load
        setTimeout(() => {
          initializeTikTokSidebar()
        }, 1500)
      }
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
    autoDetection: true,
    hideComments: true,
    scrollNavigation: true,
    videoControls: true,
    tikTokSidebar: true,
    lastScreenMode: "landscape",
    commentOverride: null,
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

// TikTok-Style Sidebar Functionality
function initializeTikTokSidebar() {
  if (!currentSettings.tikTokSidebar || !isInPostModal()) return

  // Remove existing sidebar if present
  removeTikTokSidebar()

  // Reset username tracking for fresh start
  lastSetUsername = null

  // Create and inject the sidebar
  createTikTokSidebar()

  // Setup observer to update sidebar content
  setupSidebarObserver()
}

function createTikTokSidebar() {
  // Create sidebar container
  sidebarElement = document.createElement("div")
  sidebarElement.id = "ig-enhancer-tiktok-sidebar"
  sidebarElement.innerHTML = `
    <div class="sidebar-item user-profile">
      <div class="avatar-container">
        <a href="" class="user-link">
          <img class="user-avatar" src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMjAiIGN5PSIyMCIgcj0iMjAiIGZpbGw9IiNkYmRiZGIiLz4KPGF0aCBkPSJNMjAgMTBjLTUuNTIzIDAtMTAgNC40NzctMTAgMTBzNC40NzcgMTAgMTAgMTAgMTAtNC40NzcgMTAtMTAtNC40NzctMTAtMTAtMTB6bTAgNmMxLjY1NyAwIDMgMS4zNDMgMyAzcy0xLjM0MyAzLTMgMy0zLTEuMzQzLTMtM3MxLjM0My0zIDMtM3ptMCA4YzIuNzYxIDAgNS0yLjIzOSA1LTV2LTFjLTEuNzA2IDEuMjI0LTMuNzg0IDItNiAycy00LjI5NC0uNzc2LTYtMnYxYzAgMi43NjEgMi4yMzkgNSA1IDV6IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K" alt="User Avatar">
        </a>
      </div>
    </div>
    
    <div class="sidebar-item like-section">
      <button class="action-btn like-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M16.792 3.904A4.989 4.989 0 0 1 21.5 9.122c0 3.072-2.652 4.959-5.197 7.222-2.512 2.243-3.865 3.469-4.303 3.752-.477-.309-2.143-1.823-4.303-3.752C5.141 14.072 2.5 12.167 2.5 9.122a4.989 4.989 0 0 1 4.708-5.218 4.21 4.21 0 0 1 3.675 1.941c.84 1.175.98 1.763 1.12 1.763s.278-.588 1.11-1.766a4.17 4.17 0 0 1 3.679-1.938m0-2a6.04 6.04 0 0 0-4.797 2.127 6.052 6.052 0 0 0-4.787-2.127A6.985 6.985 0 0 0 .5 9.122c0 3.61 2.55 5.827 5.015 7.97.283.246.569.494.853.747l1.027.918a44.998 44.998 0 0 0 3.518 3.018 2 2 0 0 0 2.174 0 45.263 45.263 0 0 0 3.626-3.115l.922-.824c.293-.26.59-.519.885-.774 2.334-2.025 4.98-4.32 4.98-7.94a6.985 6.985 0 0 0-6.708-7.218Z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
      <div class="count like-count">0</div>
    </div>
    
    <div class="sidebar-item comment-section">
      <button class="action-btn comment-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M20.656 17.008a9.993 9.993 0 1 0-3.59 3.615L22 22Z" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
    
    <div class="sidebar-item share-section">
      <button class="action-btn share-btn">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <line x1="22" x2="9.218" y1="3" y2="10.083" stroke="currentColor" stroke-width="1.5"/>
          <polygon points="11.698 20.334 22 3.001 2 3.001 9.218 10.084 11.698 20.334" stroke="currentColor" stroke-width="1.5"/>
        </svg>
      </button>
    </div>
  `

  // Add CSS styles
  addTikTokSidebarCSS()

  // Add event listeners
  setupSidebarEventListeners()

  // Extract and populate data
  populateSidebarData()

  // Find the navigation container and inject sidebar
  const navContainer = findNavigationContainer()
  if (navContainer) {
    navContainer.appendChild(sidebarElement)
  } else {
    // Fallback to body if navigation container not found
    document.body.appendChild(sidebarElement)
  }
}

function findNavigationContainer() {
  // Try to find navigation container by looking for navigation buttons
  const navButtons = document.querySelectorAll('button[type="button"]')

  for (const button of navButtons) {
    const svg = button.querySelector("svg")
    if (svg) {
      const ariaLabel = svg.getAttribute("aria-label")
      const title = svg.querySelector("title")?.textContent

      if (ariaLabel === "Next" || title === "Next") {
        // Found the next button, return body for fixed positioning
        return document.body
      }
    }
  }

  // Fallback to body
  return document.body
}

function formatCount(countStr) {
  const count = parseInt(countStr.replace(/[^\d]/g, "")) || 0

  if (count >= 1000000) {
    return (count / 1000000).toFixed(1).replace(".0", "") + "M"
  } else if (count >= 1000) {
    return (count / 1000).toFixed(1).replace(".0", "") + "K"
  }

  return count.toString()
}

function addTikTokSidebarCSS() {
  const styleId = "ig-enhancer-tiktok-sidebar-styles"

  if (document.getElementById(styleId)) return

  const style = document.createElement("style")
  style.id = styleId
  style.textContent = `
    #ig-enhancer-tiktok-sidebar {
      position: fixed;
      right: 5px;
      top: 60%;
      transform: translateY(-50%);
      z-index: 1000;
      display: flex;
      flex-direction: column;
      gap: 12px;
      background: rgba(0, 0, 0, 0.05);
      backdrop-filter: blur(8px);
      border-radius: 8px;
      padding: 8px 5px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
      width: 44px;
    }

    /* Position adjustment based on screen orientation */
    @media (orientation: portrait) {
      #ig-enhancer-tiktok-sidebar {
        top: 62%;
      }
    }

    @media (orientation: landscape) {
      #ig-enhancer-tiktok-sidebar {
        top: 70%;
      }
    }

    #ig-enhancer-tiktok-sidebar:hover {
      background: rgba(0, 0, 0, 0.1);
      border-color: rgba(255, 255, 255, 0.2);
    }

    .sidebar-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }

    .user-profile {
      cursor: pointer;
      transition: transform 0.2s ease;
    }

    .user-profile:hover {
      transform: scale(1.1);
    }

    .avatar-container {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid rgba(255, 255, 255, 0.3);
      transition: border-color 0.2s ease;
    }

    .user-profile:hover .avatar-container {
      border-color: rgba(255, 255, 255, 0.8);
    }

    .user-link {
      display: block;
      width: 100%;
      height: 100%;
      text-decoration: none;
    }

    .user-avatar {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .action-btn {
      width: 36px;
      height: 36px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(5px);
      color: white;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.2s ease;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .action-btn:hover {
      background: rgba(255, 255, 255, 0.2);
      transform: scale(1.1);
      border-color: rgba(255, 255, 255, 0.4);
    }

    .action-btn:active {
      transform: scale(0.95);
    }

    #ig-enhancer-tiktok-sidebar .sidebar-item .action-btn.like-btn.liked {
      background: #ed4956 !important;
      color: #ffffff !important;
      border-color: #ed4956 !important;
      border: 2px solid #ed4956 !important;
    }

    #ig-enhancer-tiktok-sidebar .sidebar-item .action-btn.like-btn.liked:hover {
      background: #c73650 !important;
      border-color: #c73650 !important;
    }

    #ig-enhancer-tiktok-sidebar .sidebar-item .action-btn.like-btn.liked svg {
      color: #ffffff !important;
    }

    #ig-enhancer-tiktok-sidebar .sidebar-item .action-btn.like-btn.liked svg path {
      fill: #ffffff !important;
      stroke: #ffffff !important;
    }

    /* Debug - this should make ANY liked button have a yellow border */
    .like-btn.liked {
      border: 3px solid yellow !important;
    }

    .count {
      font-size: 10px;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
      font-weight: 600;
      text-align: center;
      min-width: 36px;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 10px;
      padding: 2px 4px;
      line-height: 1.2;
    }

    /* Responsive adjustments */
    @media (max-width: 768px) {
      #ig-enhancer-tiktok-sidebar {
        right: 12px;
        gap: 10px;
        padding: 6px;
        width: 40px;
      }
      
      .avatar-container {
        width: 32px;
        height: 32px;
      }
      
      .action-btn {
        width: 32px;
        height: 32px;
      }
      
      .action-btn svg {
        width: 16px;
        height: 16px;
      }
      
      .count {
        font-size: 9px;
        min-width: 32px;
      }
    }

    /* Hide when comments are shown to avoid overlap */
    .ig-enhancer-sidebar-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(-50%) translateX(20px);
    }
  `

  document.head.appendChild(style)
}

function setupSidebarEventListeners() {
  if (!sidebarElement) return

  // User profile click - just handle left clicks to prevent default
  const userLink = sidebarElement.querySelector(".user-link")
  userLink.addEventListener("click", handleUserProfileClick)

  // Like button click
  const likeBtn = sidebarElement.querySelector(".like-btn")
  likeBtn.addEventListener("click", handleLikeClick)

  // Comment button click
  const commentBtn = sidebarElement.querySelector(".comment-btn")
  commentBtn.addEventListener("click", handleCommentToggle)

  // Share button click
  const shareBtn = sidebarElement.querySelector(".share-btn")
  shareBtn.addEventListener("click", handleShareClick)
}

// Add a flag to prevent infinite loops
let isUpdatingSidebar = false
let sidebarUpdateTimeout = null
let lastSetUsername = null // Track the last username we set to avoid unnecessary updates

function extractLikeCount() {
  let likeCount = "0"

  try {
    // Method 1: Find the "liked_by" link (most reliable for "X others" format)
    const likedByLink = document.querySelector('a[href*="/liked_by/"]')
    if (likedByLink) {
      // Get all text content and look for number + "others"
      const linkText = likedByLink.textContent.trim()

      // Match "X others" pattern (when someone you follow liked it)
      const othersMatch = linkText.match(/([\d,]+)\s+others/i)
      if (othersMatch) {
        likeCount = othersMatch[1].replace(/,/g, "")
        console.log(
          "IG Enhancer: Found like count in 'others' format:",
          likeCount
        )
        return likeCount
      }

      // Match simple "X likes" pattern
      const likesMatch = linkText.match(/([\d,]+)\s+likes?/i)
      if (likesMatch) {
        likeCount = likesMatch[1].replace(/,/g, "")
        console.log(
          "IG Enhancer: Found like count in 'likes' format:",
          likeCount
        )
        return likeCount
      }
    }

    // Method 2: Look specifically for the number in span.html-span (for complex structure)
    const numberSpan = document.querySelector(
      'a[href*="/liked_by/"] span.html-span'
    )
    if (numberSpan) {
      const numberText = numberSpan.textContent.trim()
      const numberMatch = numberText.match(/^([\d,]+)$/)
      if (numberMatch) {
        likeCount = numberMatch[1].replace(/,/g, "")
        console.log("IG Enhancer: Found like count in html-span:", likeCount)
        return likeCount
      }
    }

    // Method 3: Backup - look for any span containing number + "others"
    const spans = document.querySelectorAll("span")
    for (const span of spans) {
      const text = span.textContent.trim()

      // Look for "X others" pattern
      const othersMatch = text.match(/^([\d,]+)\s+others$/i)
      if (othersMatch) {
        likeCount = othersMatch[1].replace(/,/g, "")
        console.log(
          "IG Enhancer: Found like count in span 'others' format:",
          likeCount
        )
        return likeCount
      }

      // Look for "X likes" pattern
      const likesMatch = text.match(/^([\d,]+)\s+likes?$/i)
      if (likesMatch) {
        likeCount = likesMatch[1].replace(/,/g, "")
        console.log(
          "IG Enhancer: Found like count in span 'likes' format:",
          likeCount
        )
        return likeCount
      }
    }

    // Method 4: Look for the specific structure when someone you follow liked it
    // Find elements containing "others" and extract the number before it
    const othersElements = document.querySelectorAll("*")
    for (const element of othersElements) {
      const text = element.textContent
      if (text && text.includes(" others")) {
        // Look for "Liked by username and X others" pattern
        const complexMatch = text.match(/and\s+([\d,]+)\s+others/i)
        if (complexMatch) {
          likeCount = complexMatch[1].replace(/,/g, "")
          console.log(
            "IG Enhancer: Found like count in complex 'and X others' format:",
            likeCount
          )
          return likeCount
        }

        // Look for simple "X others" pattern
        const simpleMatch = text.match(/([\d,]+)\s+others/i)
        if (simpleMatch) {
          likeCount = simpleMatch[1].replace(/,/g, "")
          console.log(
            "IG Enhancer: Found like count in 'others' format:",
            likeCount
          )
          return likeCount
        }
      }
    }

    console.log("IG Enhancer: No like count found, defaulting to 0")
    return "0"
  } catch (error) {
    console.log("IG Enhancer: Error extracting like count:", error)
    return "0"
  }
}

function detectPageType() {
  const urlPath = window.location.pathname

  // User profile page: /username/ or /username/p/postid/
  // Check if URL starts with /username/ (not /p/, /explore/, /reels/, etc.)
  const profileMatch = urlPath.match(/^\/([^\/]+)\/?/)
  if (profileMatch) {
    const segment = profileMatch[1]
    // Exclude known non-user paths
    const nonUserPaths = [
      "p",
      "explore",
      "reels",
      "tv",
      "stories",
      "accounts",
      "direct",
    ]
    if (!nonUserPaths.includes(segment)) {
      return {
        type: "profile",
        username: segment,
      }
    }
  }

  // Explore page
  if (urlPath.includes("/explore/")) {
    return { type: "explore" }
  }

  // Individual post (not from profile)
  if (urlPath.includes("/p/")) {
    return { type: "post" }
  }

  // Home feed or other
  return { type: "feed" }
}

function populateSidebarData() {
  if (!sidebarElement || isUpdatingSidebar) return

  // Debounce rapid calls
  if (sidebarUpdateTimeout) {
    clearTimeout(sidebarUpdateTimeout)
  }

  sidebarUpdateTimeout = setTimeout(() => {
    try {
      isUpdatingSidebar = true // Prevent recursive calls

      // Detect what type of page we're on
      const pageInfo = detectPageType()

      // Extract username and avatar from the header
      const dialog = document.querySelector('div[role="dialog"]')
      const headerScope = dialog
        ? dialog.querySelector("header")
        : document.querySelector("main header")

      const userAvatar = headerScope?.querySelector(
        'img[alt$="\'s profile picture"]'
      )

      if (userAvatar) {
        const avatarSrc = userAvatar.src
        const username = userAvatar.alt.replace(/'s profile picture$/, "")

        // Smart avatar updating logic
        let shouldUpdateAvatar = false

        if (pageInfo.type === "profile") {
          // On profile pages, only update avatar if username actually changed or first time
          if (!lastSetUsername || lastSetUsername !== username) {
            shouldUpdateAvatar = true
            console.log(
              `IG Enhancer: Profile page - updating avatar for user: ${username}`
            )
          }
          // Don't update avatar for same user on profile page
        } else {
          // On explore/feed pages, always update avatar as each post might be from different users
          if (lastSetUsername !== username) {
            shouldUpdateAvatar = true
            console.log(
              `IG Enhancer: ${pageInfo.type} page - updating avatar for user: ${username}`
            )
          }
        }

        if (shouldUpdateAvatar) {
          const avatarImg = sidebarElement.querySelector(".user-avatar")
          const userLink = sidebarElement.querySelector(".user-link")

          avatarImg.src = avatarSrc
          userLink.href = `/${username}/`
          sidebarElement.dataset.username = username
          lastSetUsername = username
        }
      }

      // Always update like count (this should work on all page types)
      const likeCount = extractLikeCount()
      const likeCountElement = sidebarElement.querySelector(".like-count")
      const formattedLikeCount = formatCount(likeCount)
      if (likeCountElement.textContent !== formattedLikeCount) {
        likeCountElement.textContent = formattedLikeCount
      }

      // Always check if post is already liked (this should work on all page types)
      const postModal = document.querySelector('article[role="presentation"]')
      const section = postModal?.querySelector("section")
      const likeBtn = sidebarElement.querySelector(".like-btn")

      if (section && likeBtn) {
        // Check for "Unlike" svg to determine if post is already liked
        const isLiked =
          section.querySelector('svg[aria-label="Unlike"][height="24"]') !==
          null

        // Only update if state has actually changed
        const currentlyLiked = likeBtn.classList.contains("liked")

        if (isLiked && !currentlyLiked) {
          likeBtn.classList.add("liked")
          likeBtn.style.backgroundColor = "#ed4956"
          likeBtn.style.borderColor = "#ed4956"
          console.log(
            "IG Enhancer: Applied liked state to sidebar button for already-liked post"
          )
        } else if (!isLiked && currentlyLiked) {
          likeBtn.classList.remove("liked")
          likeBtn.style.backgroundColor = ""
          likeBtn.style.borderColor = ""
          console.log("IG Enhancer: Applied unliked state to sidebar button")
        }
        // If state hasn't changed, don't log anything
      }
    } catch (error) {
      console.log("IG Enhancer: Error populating sidebar data:", error)
    } finally {
      isUpdatingSidebar = false // Always reset the flag
    }
  }, 200) // 200ms debounce
}

function handleUserProfileClick(event) {
  // Only prevent default for regular left clicks (no modifiers)
  if (
    event.button === 0 &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  ) {
    event.preventDefault()
    event.stopPropagation()
    window.location.href = event.target.closest(".user-link").href
  }
  // Let middle-click and ctrl+click open in new tab, let right-click show context menu
}

function handleLikeClick(event) {
  event.preventDefault()
  event.stopPropagation()

  try {
    if (!sidebarElement) return

    const postModal = document.querySelector('article[role="presentation"]')
    if (!postModal) return

    const section = postModal.querySelector("section")
    if (!section) return

    let likeButton = null

    // Look for like/unlike button using more stable selectors
    const likeSvg = section.querySelector('svg[aria-label="Like"][height="24"]')
    const unlikeSvg = section.querySelector(
      'svg[aria-label="Unlike"][height="24"]'
    )

    const targetSvg = likeSvg || unlikeSvg

    if (targetSvg) {
      // Find the clickable parent element (div[role="button"])
      let element = targetSvg.parentElement
      while (element && element !== section) {
        if (element.getAttribute("role") === "button") {
          likeButton = element
          break
        }
        element = element.parentElement
      }
    }

    if (likeButton) {
      // Click the actual Instagram like button
      likeButton.click()

      // Wait and check the state
      setTimeout(() => {
        if (!sidebarElement) return

        const updatedPostModal = document.querySelector(
          'article[role="presentation"]'
        )
        const updatedSection = updatedPostModal?.querySelector("section")

        if (updatedSection) {
          // Check current state by aria-label
          const isLiked =
            updatedSection.querySelector(
              'svg[aria-label="Unlike"][height="24"]'
            ) !== null

          // Update sidebar like button appearance
          const sidebarLikeBtn = sidebarElement.querySelector(".like-btn")
          if (sidebarLikeBtn) {
            if (isLiked) {
              sidebarLikeBtn.classList.add("liked")
              sidebarLikeBtn.style.backgroundColor = "#ed4956"
              sidebarLikeBtn.style.borderColor = "#ed4956"
            } else {
              sidebarLikeBtn.classList.remove("liked")
              sidebarLikeBtn.style.backgroundColor = ""
              sidebarLikeBtn.style.borderColor = ""
            }
          }
        }

        // Update the like count
        populateSidebarData()
      }, 1000)
    }
  } catch (error) {
    console.log("IG Enhancer: Error handling like click:", error)
  }
}

function handleCommentToggle(event) {
  event.preventDefault()
  event.stopPropagation()

  // Toggle comments visibility using existing functionality
  const shouldHide = !getShouldHideComments()

  // Update override to toggle comments
  currentSettings.commentOverride = shouldHide
  saveSettings({ commentOverride: shouldHide })

  // Apply the change
  updateCommentsVisibility(shouldHide)

  // Update sidebar visibility
  updateSidebarVisibility()
}

function handleShareClick(event) {
  event.preventDefault()
  event.stopPropagation()

  try {
    // Find the share button in the section
    const section = document.querySelector("section")
    if (section) {
      const buttons = section.querySelectorAll("button")
      // Share button is typically the third button (like, comment, share)
      const shareButton = buttons[2]
      if (shareButton) {
        shareButton.click()
      }
    }
  } catch (error) {
    console.log("IG Enhancer: Error handling share click:", error)
  }
}

function updateSidebarVisibility() {
  if (!sidebarElement) return

  const commentsVisible = !getShouldHideComments()

  if (commentsVisible) {
    sidebarElement.classList.add("ig-enhancer-sidebar-hidden")
  } else {
    sidebarElement.classList.remove("ig-enhancer-sidebar-hidden")
  }
}

function setupSidebarObserver() {
  // Update sidebar on content changes
  if (sidebarObserver) return

  sidebarObserver = new MutationObserver(mutations => {
    let shouldUpdate = false

    mutations.forEach(mutation => {
      if (
        mutation.target.id === "ig-enhancer-tiktok-sidebar" ||
        mutation.target.closest("#ig-enhancer-tiktok-sidebar")
      ) {
        return
      }

      if (
        mutation.target.matches &&
        (mutation.target.matches("section") ||
          mutation.target.closest("section")) &&
        !mutation.target.closest("#ig-enhancer-tiktok-sidebar")
      ) {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          shouldUpdate = true
        } else if (
          mutation.type === "attributes" &&
          (mutation.attributeName === "aria-label" ||
            mutation.attributeName === "fill")
        ) {
          shouldUpdate = true
        }
      }
    })

    if (shouldUpdate && sidebarElement && !isUpdatingSidebar) {
      // Debounce updates
      clearTimeout(window.sidebarUpdateTimeout)
      window.sidebarUpdateTimeout = setTimeout(() => {
        populateSidebarData()
      }, 500) // Increased debounce time
    }
  })

  sidebarObserver.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "fill"], // Only watch for specific attribute changes
  })
}

function removeTikTokSidebar() {
  if (sidebarElement) {
    sidebarElement.remove()
    sidebarElement = null
  }

  if (sidebarObserver) {
    sidebarObserver.disconnect()
    sidebarObserver = null
  }

  // Reset the username tracking when sidebar is removed
  lastSetUsername = null

  // Remove styles
  const styles = document.getElementById("ig-enhancer-tiktok-sidebar-styles")
  if (styles) {
    styles.remove()
  }
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
    // Only clear override when screen mode actually changes and we're switching
    // to a mode that would naturally match what the override was doing
    if (currentSettings.commentOverride !== null) {
      const autoWouldHide = isPortrait
      if (currentSettings.commentOverride === autoWouldHide) {
        // Override matches what auto detection would do, so clear it
        currentSettings.commentOverride = null
        saveSettings({ commentOverride: null })
      }
    }

    // Apply comment visibility based on current state
    const shouldHideComments = getShouldHideComments()
    updateCommentsVisibility(shouldHideComments)
  }

  // Update sidebar visibility
  if (currentSettings.tikTokSidebar) {
    updateSidebarVisibility()
  }

  // Always send status update to popup to ensure it's current
  sendStatusUpdate()
}

function getShouldHideComments() {
  if (currentSettings.commentOverride !== null) {
    // Override takes precedence
    return currentSettings.commentOverride
  }

  if (currentSettings.autoDetection) {
    // Auto detection: hide in portrait, show in landscape
    return currentSettings.lastScreenMode === "portrait"
  } else {
    // Manual mode
    return currentSettings.hideComments
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

  // Update sidebar visibility when comments visibility changes
  if (currentSettings.tikTokSidebar) {
    updateSidebarVisibility()
  }
}

function shouldHideComments() {
  return getShouldHideComments()
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

  // Check if the scroll event originated from within the comments section
  if (isScrollingInCommentsArea(event.target)) {
    return // Allow normal scrolling in comments, don't navigate posts
  }

  // Check if scrolling in a scrollable content area (like long captions)
  if (isScrollingInScrollableContent(event.target)) {
    return // Allow normal scrolling in scrollable content
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

function isScrollingInCommentsArea(target) {
  // Find the closest article container
  let element = target
  let article = null

  while (element && element !== document.body) {
    if (
      element.tagName === "ARTICLE" &&
      element.getAttribute("role") === "presentation"
    ) {
      article = element
      break
    }
    element = element.parentElement
  }

  if (!article) {
    return false // Not within a post modal
  }

  // Get the main container div (first child of article)
  const mainContainer = article.querySelector("div")
  if (!mainContainer) {
    return false
  }

  // Get all direct child divs of the main container
  const childDivs = Array.from(mainContainer.children).filter(
    child => child.tagName === "DIV"
  )

  if (childDivs.length < 2) {
    return false // Expected structure not found
  }

  // First div should contain media (video/photo), second div should contain comments/interactions
  const mediaContainer = childDivs[0]
  const commentsContainer = childDivs[1]

  // Check if the scroll target is within the comments container
  if (commentsContainer && commentsContainer.contains(target)) {
    return true
  }

  // Additional check: look for media elements in first container to confirm structure
  const hasMedia =
    mediaContainer &&
    (mediaContainer.querySelector("video") ||
      mediaContainer.querySelector("img") ||
      mediaContainer.querySelector("canvas"))

  // If target is in media container, allow post navigation
  if (hasMedia && mediaContainer && mediaContainer.contains(target)) {
    return false
  }

  // For safety, if we can't determine the structure clearly, assume it's comments area
  return true
}

function isScrollingInScrollableContent(target) {
  // Check if scrolling within any legitimately scrollable content area
  let element = target
  while (element && element !== document.body) {
    // Skip if this is the main document scroll
    if (element === document.documentElement || element === document.body) {
      element = element.parentElement
      continue
    }

    // Check if element has scrollable overflow and actual scrollable content
    if (element.scrollHeight > element.clientHeight) {
      const computedStyle = window.getComputedStyle(element)
      const overflowY = computedStyle.overflowY
      const overflow = computedStyle.overflow

      if (
        overflowY === "auto" ||
        overflowY === "scroll" ||
        overflow === "auto" ||
        overflow === "scroll" ||
        (overflowY === "hidden" && element.scrollTop > 0)
      ) {
        // Additional check: make sure this isn't the main post container
        // by checking if it's within an article but not the article itself
        const parentArticle = element.closest('article[role="presentation"]')
        if (parentArticle && element !== parentArticle) {
          return true
        }
      }
    }
    element = element.parentElement
  }
  return false
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

// Video Controls Functionality (preserved from original)
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

    // Initialize TikTok sidebar for new posts
    if (currentSettings.tikTokSidebar) {
      setTimeout(() => {
        initializeTikTokSidebar()
      }, 1000) // Increased delay to ensure content is fully loaded
    }
  } else {
    // Remove sidebar when not in post modal
    removeTikTokSidebar()
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

        if (currentSettings.tikTokSidebar) {
          setTimeout(() => {
            initializeTikTokSidebar()
          }, 1000)
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
        removeTikTokSidebar()
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
      saveSettings({
        autoDetection: message.enabled,
        // Clear override when auto detection is toggled
        commentOverride: null,
      })
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

    case "commentOverrideChanged":
      currentSettings.commentOverride = message.override
      saveSettings({ commentOverride: message.override })

      // Apply the override immediately
      updateCommentsVisibility(getShouldHideComments())

      sendResponse({ status: "Comment override updated" })
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

    case "tikTokSidebarChanged":
      currentSettings.tikTokSidebar = message.enabled
      saveSettings({ tikTokSidebar: message.enabled })

      if (message.enabled && isInPostModal()) {
        initializeTikTokSidebar()
      } else {
        removeTikTokSidebar()
      }

      sendResponse({ status: "TikTok sidebar updated" })
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
  removeTikTokSidebar()
  window.removeEventListener("resize", handleResize)
  window.removeEventListener("orientationchange", handleResize)
  window.removeEventListener("focus", handleResize)
  disconnectVideoObserver()
})
