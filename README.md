# Mobile Mapper - Portable Projection Mapping App

A lightweight web-based projection mapping application designed for mobile phones and portable projectors. Create and perform projection mapping on the go without requiring an internet connection.

## Features

- **Edit Mode**: Create and manipulate projection surfaces
  - Add triangles and squares
  - Draw custom polygons by placing vertices
  - Move and edit vertices with precision
  - Fine-grain editing with arrow buttons

- **Content Options**:
  - **Shaders**: Animated procedural graphics (Rainbow, Plasma, Waves, Checkerboard, Solid)
  - **Videos**: Upload and map your own video files

- **Performance Mode**: Clean output view with hidden controls for live projection

- **Mobile Optimized**:
  - Touch-friendly interface
  - Works offline (Progressive Web App)
  - Fullscreen support
  - Auto-save to local storage

## How to Use

### Getting Started

1. Open `index.html` in a modern web browser on your mobile device
2. For offline use, the app will cache itself on first load
3. Grant fullscreen permissions for best projection experience

### Creating Shapes

**Quick Shapes:**

- Tap the **△** button to add a triangle
- Tap the **□** button to add a square
- Shapes appear at the center of your tap

**Custom Polygons:**

1. Tap the **✎** (draw) button
2. Tap to place vertices (minimum 3 points)
3. Tap the last vertex again or switch tools to finish

### Editing Shapes

**Select Mode (⊕):**

- Tap a shape to select it (turns green)
- Drag vertices to reposition them
- Drag the shape body to move entire shape
- Use arrow buttons for pixel-perfect adjustments

**Delete:**

- Select a shape
- Tap the **🗑** (trash) button

### Adding Content

1. Select a shape
2. Tap the **🎨** (change content) button
3. Choose **Shader** or **Video**
4. For shaders: Pick from 5 animated options
5. For videos: Upload a file from your device

### Performance Mode

- Tap **Performance Mode** to hide all controls
- Shows only the projection output
- Tap **Exit Performance Mode** in the corner to return to editing

### Fullscreen

- Tap **Fullscreen** to enter fullscreen mode
- Essential for projection use
- Exit fullscreen using browser controls or device back button

### Saving Your Work

**Auto-Save:**

- Projects auto-save to browser local storage
- Automatically loads on next visit

**Manual Save:**

- Tap **Save Project** to save current state
- Tap **Load Project** to import a saved .json file

## System Requirements

- Modern web browser with WebGL support
- iOS 11+ (Safari) or Android 5+ (Chrome)
- Touch screen recommended (mouse also supported)

## Technical Details

- Built with vanilla JavaScript (no frameworks)
- WebGL for high-performance rendering
- Progressive Web App (PWA) for offline use
- Canvas API for editing overlays
- Local Storage for project persistence

## Browser Compatibility

- **Best**: Chrome/Edge (Android), Safari (iOS)
- **Supported**: Firefox, Opera
- **Required**: WebGL, Service Workers

## Tips for Projection Mapping

1. **Calibration**: Create shapes that match your physical surfaces
2. **Lighting**: Works best in dark environments
3. **Alignment**: Use fullscreen mode and rotate device to landscape
4. **Vertices**: More vertices = more precise mapping but harder to manage
5. **Content**: Videos should be short and looped for best performance
6. **Battery**: Keep device charged during performances

## File Structure

```
MobileMapper/
├── index.html          # Main HTML file
├── styles.css          # Styling and responsive design
├── app.js              # Main application logic
├── polygon.js          # Polygon class and shape factory
├── renderer.js         # WebGL rendering engine
├── shaders.js          # Shader definitions
├── sw.js               # Service worker for offline support
├── manifest.json       # PWA manifest
└── README.md           # This file
```

## Development

To modify or extend:

1. Edit shader effects in `shaders.js`
2. Add new tools in `app.js`
3. Modify UI in `index.html` and `styles.css`
4. Update renderer logic in `renderer.js`

## Troubleshooting

**App won't load:**

- Check if WebGL is supported: visit https://get.webgl.org/
- Try a different browser
- Clear cache and reload

**Videos won't play:**

- Use H.264 encoded MP4 files
- Keep files under 50MB for mobile performance
- Enable autoplay in browser settings

**Touch not working:**

- Ensure not in desktop mode
- Try refreshing the page
- Check touch sensitivity in device settings

**Performance issues:**

- Reduce number of polygons
- Use shaders instead of videos
- Close other apps
- Disable battery saver mode

## License

Free to use for personal and commercial projects.

## Credits

Created for portable projection mapping enthusiasts.
