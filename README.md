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

### Option 1: Docker (Recommended)

1. Clone the repository
2. Build and run with Docker Compose:
   ```bash
   docker-compose up --build
   ```
3. Open http://localhost:5000 in your browser

### Option 2: Local Python Installation

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

## Docker Development

### Production Build
```bash
# Build and run production container
docker-compose up --build

# Run in background
docker-compose up -d --build

# View logs
docker-compose logs -f

# Stop the application
docker-compose down
```

### Development Build (with hot reload)
```bash
# Run development container with hot reload
docker-compose --profile dev up --build log-analyzer-dev

# Access development server at http://localhost:5001
```

### Docker Commands
```bash
# Build image only
docker build -t log-analyzer .

# Run container directly
docker run -p 5000:5000 log-analyzer

# Run with volume for persistent uploads
docker run -p 5000:5000 -v uploads_data:/app/uploads log-analyzer
```

### Helper Scripts

For convenience, use the provided helper scripts:

**Linux/macOS:**
```bash
# Make script executable
chmod +x docker-scripts.sh

# Build production image
./docker-scripts.sh build

# Start development environment
./docker-scripts.sh dev

# Start production environment
./docker-scripts.sh prod

# Stop all containers
./docker-scripts.sh stop

# Clean up Docker resources
./docker-scripts.sh clean

# View logs
./docker-scripts.sh logs

# Open shell in container
./docker-scripts.sh shell
```

**Windows PowerShell:**
```powershell
# Build production image
.\docker-scripts.ps1 build

# Start development environment
.\docker-scripts.ps1 dev

# Start production environment
.\docker-scripts.ps1 prod

# Stop all containers
.\docker-scripts.ps1 stop

# Clean up Docker resources
.\docker-scripts.ps1 clean

# View logs
.\docker-scripts.ps1 logs

# Open shell in container
.\docker-scripts.ps1 shell
```

## Local Development (without Docker)

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Run the application:
```bash
python app.py
```

3. Open http://localhost:5000 in your browser

## Docker Deployment

### Docker Hub Deployment

1. Build and tag your image:
   ```bash
   docker build -t yourusername/log-analyzer:latest .
   ```

2. Push to Docker Hub:
   ```bash
   docker push yourusername/log-analyzer:latest
   ```

3. Deploy on any Docker-compatible platform:
   ```bash
   docker run -d -p 5000:5000 --name log-analyzer yourusername/log-analyzer:latest
   ```

### Cloud Platform Deployment

#### AWS ECS/Fargate
- Use the provided Dockerfile
- Configure ECS task definition with port 5000
- Set environment variables as needed

#### Google Cloud Run
- Use the provided Dockerfile
- Deploy with: `gcloud run deploy --source .`
- Automatically scales to zero when not in use

#### Azure Container Instances
- Use the provided Dockerfile
- Deploy with Azure CLI or portal

### Docker Compose Production

For production deployment with Docker Compose:

```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  log-analyzer:
    image: yourusername/log-analyzer:latest
    ports:
      - "80:5000"
    environment:
      - FLASK_ENV=production
    volumes:
      - uploads_data:/app/uploads
    restart: unless-stopped
```

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
├── Dockerfile          # Production Docker configuration
├── Dockerfile.dev      # Development Docker configuration
├── docker-compose.yml  # Docker Compose configuration
├── docker-compose.prod.yml # Production Docker Compose configuration
├── .dockerignore       # Docker build context exclusions
├── docker-scripts.sh   # Linux/macOS helper scripts
├── docker-scripts.ps1  # Windows PowerShell helper scripts
├── Procfile           # Railway deployment configuration
├── runtime.txt        # Python version specification
├── templates/
│   └── index.html     # Main web interface
├── static/            # Static assets (CSS, JS, images)
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