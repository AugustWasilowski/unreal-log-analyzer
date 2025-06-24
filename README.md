# Unreal Engine Log Analyzer

A modern, accessible web application for analyzing Unreal Engine log files with advanced filtering, search, and export capabilities.

## Features

- **File Upload**: Upload and analyze .log and .txt files
- **Advanced Filtering**: Filter by log type, level (Display/Warning/Error), and search terms
- **Real-time Search**: Debounced search with instant results
- **Copy to Clipboard**: Copy filtered results with keyboard shortcuts
- **Keyboard Navigation**: Full keyboard accessibility with shortcuts
- **Responsive Design**: Works on desktop and mobile devices
- **Dark Theme**: Easy on the eyes for long log analysis sessions

## Keyboard Shortcuts

- `Ctrl/Cmd + F`: Focus search input
- `Ctrl/Cmd + C`: Copy filtered results
- `Ctrl/Cmd + O`: Open file dialog
- `Escape`: Clear search or close dropdowns
- `Enter`: Submit forms or activate buttons
- `Arrow Keys`: Navigate through log entries
- `Home/End`: Jump to first/last log entry

## Architecture

The application uses a modular JavaScript architecture with separated concerns:

### Core Modules

- **`state.js`**: Centralized state management with reactive updates
- **`utils.js`**: Utility functions, performance optimizations, and error handling
- **`ui.js`**: DOM manipulation, rendering, and accessibility features
- **`api.js`**: Server communication and API calls
- **`app.js`**: Main application logic and event coordination

### Key Improvements

#### Performance Optimizations
- **DocumentFragment**: Batch DOM updates for better performance
- **Debounced Search**: 300ms debounce prevents excessive API calls
- **DOM Caching**: Cached element references reduce querySelector calls
- **Throttled Events**: Performance-critical events are throttled

#### Security Enhancements
- **XSS Prevention**: Input sanitization and safe DOM creation
- **Content Security**: No innerHTML with user data
- **Error Boundaries**: Graceful error handling throughout

#### Accessibility Features
- **ARIA Labels**: Comprehensive screen reader support
- **Keyboard Navigation**: Full keyboard accessibility
- **Focus Management**: Proper focus trapping and management
- **Semantic HTML**: Proper HTML structure and roles

#### State Management
- **Centralized State**: Single source of truth for application state
- **Reactive Updates**: Automatic UI updates on state changes
- **Filter Management**: Efficient filtering with multiple criteria
- **Loading States**: Consistent loading indicators

## Installation

1. Clone the repository
2. Install Python dependencies: `pip install -r requirements.txt`
3. Run the application: `python app.py`
4. Open http://localhost:5000 in your browser

## Usage

1. **Upload a Log File**: Click "Choose File" or use `Ctrl/Cmd + O`
2. **Filter by Type**: Use the checkboxes to filter by log categories
3. **Filter by Level**: Toggle Display/Warning/Error levels
4. **Search**: Type in the search box or use `Ctrl/Cmd + F`
5. **Copy Results**: Click the copy button or use `Ctrl/Cmd + C`

## Technical Details

### Backend (Flask)
- File upload handling with size limits
- Log parsing with Unreal Engine category recognition
- RESTful API endpoints for upload and filtering
- Secure filename handling

### Frontend (Vanilla JavaScript)
- Modular ES6 class-based architecture
- No external dependencies beyond Bootstrap
- Progressive enhancement approach
- Cross-browser compatibility

### Performance
- Efficient log parsing and filtering
- Optimized DOM manipulation
- Minimal memory footprint
- Fast search and filtering

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.

---

**Vibe-coded by [Mayor Awesome](https://linktr.ee/mayorawesome)**

## Local Development

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open http://localhost:5000 in your browser

## Railway Deployment

This application is configured for deployment on Railway.

### Prerequisites

- Railway account
- Railway CLI installed: `npm install -g @railway/cli`

### Deployment Steps

1. Login to Railway:
```bash
railway login
```

2. Navigate to the project directory:
```bash
cd log_analyzer
```

3. Initialize Railway project (if not already done):
```bash
railway init
```

4. Deploy the application:
```bash
railway up
```

5. Get your live URL:
```bash
railway status
```

### Environment Variables

The application automatically detects Railway's environment:
- `PORT`: Automatically set by Railway
- `FLASK_ENV`: Set to 'production' for production deployment

### File Storage

Note: Railway uses ephemeral storage, so uploaded files will be lost when the app restarts. For production use, consider:
- Using Railway's persistent storage
- Integrating with cloud storage (AWS S3, Google Cloud Storage)

## Project Structure

```
log_analyzer/
├── app.py              # Main Flask application
├── requirements.txt    # Python dependencies
├── Procfile           # Railway deployment configuration
├── runtime.txt        # Python version specification
├── templates/
│   └── index.html     # Main web interface
├── uploads/           # Temporary file upload directory
└── README.md          # This file
```

## Supported Log Categories

The application recognizes official Unreal Engine log categories including:
- LogCore, LogEngine, LogWorld
- LogNet, LogRep, LogPhysics
- LogRender, LogAudio, LogInput
- And many more...

## Troubleshooting

### Common Issues

1. **Module not found errors**: Ensure all dependencies are in `requirements.txt`
2. **App won't start**: Check Railway logs with `railway logs`
3. **File upload issues**: Remember that Railway uses ephemeral storage

### Getting Help

- Check Railway logs: `railway logs`
- View deployment status: `railway status`
- Railway documentation: https://docs.railway.app/ 