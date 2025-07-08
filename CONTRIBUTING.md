# Contributing to IG Enhancer

Thank you for your interest in contributing to IG Enhancer! We welcome contributions from everyone.

## How to Contribute

### Reporting Bugs
1. Check if the issue already exists in [Issues](../../issues)
2. If not, create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Browser version and OS
   - Screenshots if applicable

### Suggesting Features
1. Open a new issue with the `enhancement` label
2. Describe the feature and why it would be useful
3. Include mockups or examples if possible

### Code Contributions

#### Setup Development Environment
1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/ig-enhancer.git`
3. Load the extension in Chrome:
   - Go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project folder

#### Development Guidelines
- **Code Style**: Follow existing code patterns and formatting
- **Comments**: Add comments for complex logic
- **Testing**: Test your changes thoroughly on Instagram
- **Responsive**: Ensure features work on different screen sizes

#### File Structure
```
├── manifest.json      # Extension manifest (Manifest V3)
├── popup.html        # Extension popup interface
├── popup.js          # Popup logic and settings
├── background.js     # Service worker (keyboard shortcuts, etc.)
├── contentScript.js  # Main functionality injected into Instagram
└── icon.png         # Extension icon
```

#### Making Changes
1. Create a feature branch: `git checkout -b feature/your-feature-name`
2. Make your changes
3. Test thoroughly:
   - Test on different screen orientations
   - Test keyboard shortcuts
   - Test with different Instagram page types (feed, profile, post)
   - Verify settings persist correctly
4. Commit with clear messages: `git commit -m "Add: descriptive message"`
5. Push to your fork: `git push origin feature/your-feature-name`
6. Open a Pull Request

#### Pull Request Guidelines
- **Title**: Clear, descriptive title
- **Description**: Explain what changes you made and why
- **Testing**: Describe how you tested the changes
- **Screenshots**: Include before/after screenshots if UI changes

### Code Review Process
1. Maintainers will review your PR
2. Address any feedback or requested changes
3. Once approved, your PR will be merged

## Development Tips

### Testing the Extension
- Always test in an incognito window to avoid conflicts
- Test with different Instagram content types (photos, videos, carousels)
- Verify keyboard shortcuts work correctly
- Check that settings persist after browser restart

### Common Issues
- **Content not loading**: Instagram's DOM structure changes frequently
- **Settings not saving**: Check chrome.storage API usage
- **Conflicts with other extensions**: Test in clean browser profile

### Architecture Notes
- Uses Manifest V3 for future compatibility
- Content script handles all Instagram DOM manipulation
- Background script manages keyboard shortcuts and cross-tab communication
- Popup provides user interface for settings

## Questions?

Feel free to open an issue with the `question` label if you need help getting started or have questions about the codebase.