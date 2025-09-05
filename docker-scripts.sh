#!/bin/bash

# Docker management scripts for Unreal Engine Log Analyzer

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 {build|dev|prod|stop|clean|logs|shell}"
    echo ""
    echo "Commands:"
    echo "  build    - Build production Docker image"
    echo "  dev      - Start development environment with hot reload"
    echo "  prod     - Start production environment"
    echo "  stop     - Stop all containers"
    echo "  clean    - Remove containers, images, and volumes"
    echo "  logs     - Show container logs"
    echo "  shell    - Open shell in running container"
    echo ""
}

# Build production image
build_image() {
    print_status "Building production Docker image..."
    docker build -t log-analyzer:latest .
    print_success "Production image built successfully!"
}

# Start development environment
start_dev() {
    print_status "Starting development environment..."
    docker-compose --profile dev up --build log-analyzer-dev
}

# Start production environment
start_prod() {
    print_status "Starting production environment..."
    docker-compose up --build -d
    print_success "Production environment started!"
    print_status "Application available at: http://localhost:5000"
}

# Stop all containers
stop_containers() {
    print_status "Stopping all containers..."
    docker-compose down
    print_success "All containers stopped!"
}

# Clean up Docker resources
clean_docker() {
    print_warning "This will remove all containers, images, and volumes for this project."
    read -p "Are you sure? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        print_status "Cleaning up Docker resources..."
        docker-compose down -v --rmi all
        docker system prune -f
        print_success "Cleanup completed!"
    else
        print_status "Cleanup cancelled."
    fi
}

# Show logs
show_logs() {
    print_status "Showing container logs..."
    docker-compose logs -f
}

# Open shell in container
open_shell() {
    print_status "Opening shell in container..."
    docker-compose exec log-analyzer /bin/bash
}

# Main script logic
case "$1" in
    build)
        build_image
        ;;
    dev)
        start_dev
        ;;
    prod)
        start_prod
        ;;
    stop)
        stop_containers
        ;;
    clean)
        clean_docker
        ;;
    logs)
        show_logs
        ;;
    shell)
        open_shell
        ;;
    *)
        show_usage
        exit 1
        ;;
esac
