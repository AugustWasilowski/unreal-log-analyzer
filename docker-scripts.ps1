# Docker management scripts for Unreal Engine Log Analyzer

param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("build", "dev", "prod", "stop", "clean", "logs", "shell")]
    [string]$Command
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to show usage
function Show-Usage {
    Write-Host "Usage: .\docker-scripts.ps1 {build|dev|prod|stop|clean|logs|shell}"
    Write-Host ""
    Write-Host "Commands:"
    Write-Host "  build    - Build production Docker image"
    Write-Host "  dev      - Start development environment with hot reload"
    Write-Host "  prod     - Start production environment"
    Write-Host "  stop     - Stop all containers"
    Write-Host "  clean    - Remove containers, images, and volumes"
    Write-Host "  logs     - Show container logs"
    Write-Host "  shell    - Open shell in running container"
    Write-Host ""
}

# Build production image
function Build-Image {
    Write-Status "Building production Docker image..."
    docker build -t log-analyzer:latest .
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Production image built successfully!"
    } else {
        Write-Error "Failed to build image"
        exit 1
    }
}

# Start development environment
function Start-Dev {
    Write-Status "Starting development environment..."
    docker-compose --profile dev up --build log-analyzer-dev
}

# Start production environment
function Start-Prod {
    Write-Status "Starting production environment..."
    docker-compose up --build -d
    if ($LASTEXITCODE -eq 0) {
        Write-Success "Production environment started!"
        Write-Status "Application available at: http://localhost:5000"
    } else {
        Write-Error "Failed to start production environment"
        exit 1
    }
}

# Stop all containers
function Stop-Containers {
    Write-Status "Stopping all containers..."
    docker-compose down
    if ($LASTEXITCODE -eq 0) {
        Write-Success "All containers stopped!"
    } else {
        Write-Error "Failed to stop containers"
        exit 1
    }
}

# Clean up Docker resources
function Clean-Docker {
    Write-Warning "This will remove all containers, images, and volumes for this project."
    $confirmation = Read-Host "Are you sure? (y/N)"
    if ($confirmation -eq 'y' -or $confirmation -eq 'Y') {
        Write-Status "Cleaning up Docker resources..."
        docker-compose down -v --rmi all
        docker system prune -f
        if ($LASTEXITCODE -eq 0) {
            Write-Success "Cleanup completed!"
        } else {
            Write-Error "Failed to clean up resources"
            exit 1
        }
    } else {
        Write-Status "Cleanup cancelled."
    }
}

# Show logs
function Show-Logs {
    Write-Status "Showing container logs..."
    docker-compose logs -f
}

# Open shell in container
function Open-Shell {
    Write-Status "Opening shell in container..."
    docker-compose exec log-analyzer /bin/bash
}

# Main script logic
switch ($Command) {
    "build" { Build-Image }
    "dev" { Start-Dev }
    "prod" { Start-Prod }
    "stop" { Stop-Containers }
    "clean" { Clean-Docker }
    "logs" { Show-Logs }
    "shell" { Open-Shell }
    default { Show-Usage; exit 1 }
}
