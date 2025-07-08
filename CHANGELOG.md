# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0]

### Added
- **Auto Screen Detection**: Automatically hide comments on portrait screens, show on landscape
- **TikTok-Style Sidebar**: User profile, like, and comment buttons on the right side
- **Scroll Navigation**: Navigate between posts using mouse wheel
- **Video Controls**: Enable native HTML5 video controls on Instagram videos
- **Smart Comment Override**: Temporary override system for auto detection mode
- **Keyboard Shortcuts**:
  - `Alt+A`: Toggle Auto Screen Detection
  - `Alt+H`: Toggle Hide Comments / Override Auto Mode
  - `Alt+S`: Toggle Scroll Navigation
  - `Alt+T`: Toggle TikTok-Style Sidebar
- **Real-time Settings**: All changes apply instantly without page refresh
- **Status Display**: Live status indicators in popup showing current modes
- **Intelligent Scroll Detection**: Preserves normal scrolling in comments and scrollable content

### Features
- Works seamlessly with Instagram's single-page application
- Local storage for all settings (no data collection)
- Smart overlay management for video controls
- Responsive design that adapts to different screen orientations
- Debounced updates for optimal performance
- Cross-browser compatibility (Chrome/Chromium-based browsers)

### Technical
- Manifest V3 compliance
- Content script injection for Instagram domain only
- Background service worker for keyboard shortcuts
- Mutation observers for dynamic content handling
- CSS injection for styling modifications