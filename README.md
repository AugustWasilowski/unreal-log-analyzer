# Unreal Engine Log Analyzer

A Flask web application for analyzing Unreal Engine build logs with filtering capabilities.

## Features

- Upload and parse Unreal Engine log files
- Filter logs by log type categories
- Real-time log analysis
- Dark theme UI optimized for readability
- Support for large log files (up to 16MB)

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