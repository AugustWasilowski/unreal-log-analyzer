// MemReport Charts - Lightweight canvas chart utility for memory report visualization
class MemReportCharts {
    
    // Store chart instances for interaction handling
    static chartInstances = new Map();
    
    // Default chart configuration
    static defaultConfig = {
        colors: [
            '#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1',
            '#fd7e14', '#20c997', '#e83e8c', '#6c757d', '#17a2b8'
        ],
        backgroundColor: '#f8f9fa',
        showTooltips: true,
        showValues: true,
        exportFormats: ['PNG', 'SVG'],
        animation: true
    };
    
    // Render a simple bar chart using Canvas 2D API
    static renderBarChart(canvas, data, options = {}) {
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        if (!data.values || data.values.length === 0) {
            this.renderEmptyChart(ctx, width, height);
            return;
        }
        
        // Chart configuration
        const padding = {
            top: 20,
            right: 20,
            bottom: 60,
            left: 60
        };
        
        const chartWidth = width - padding.left - padding.right;
        const chartHeight = height - padding.top - padding.bottom;
        
        // Calculate chart dimensions
        const maxValue = Math.max(...data.values);
        const barWidth = Math.max(chartWidth / data.labels.length - 4, 20); // Minimum 20px width
        const actualChartWidth = barWidth * data.labels.length;
        
        // Draw background
        ctx.fillStyle = options.backgroundColor || '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        // Draw chart area background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(padding.left, padding.top, chartWidth, chartHeight);
        
        // Draw grid lines
        this.drawGridLines(ctx, padding, chartWidth, chartHeight, maxValue);
        
        // Store chart data for interactions
        const chartId = canvas.id || `chart_${Date.now()}`;
        canvas.id = chartId;
        
        const chartInstance = {
            canvas,
            data,
            options: { ...this.defaultConfig, ...options },
            padding,
            barWidth,
            chartWidth,
            chartHeight,
            maxValue,
            bars: []
        };
        
        // Draw bars and store bar data for interactions
        data.values.forEach((value, index) => {
            if (value > 0) {
                const barHeight = (value / maxValue) * chartHeight;
                const x = padding.left + (index * barWidth) + 2;
                const y = padding.top + chartHeight - barHeight;
                
                // Store bar data for interactions
                chartInstance.bars.push({
                    x,
                    y,
                    width: barWidth - 4,
                    height: barHeight,
                    value,
                    label: data.labels[index],
                    index
                });
                
                // Bar color with gradient
                const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
                const baseColor = options.colors?.[index] || this.getBarColor(index);
                gradient.addColorStop(0, baseColor);
                gradient.addColorStop(1, this.darkenColor(baseColor, 0.2));
                
                ctx.fillStyle = gradient;
                ctx.fillRect(x, y, barWidth - 4, barHeight);
                
                // Bar border
                ctx.strokeStyle = this.darkenColor(baseColor, 0.3);
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, barWidth - 4, barHeight);
                
                // Value label on top of bar
                if (barHeight > 20 && chartInstance.options.showValues) {
                    ctx.fillStyle = '#333';
                    ctx.font = '10px Arial';
                    ctx.textAlign = 'center';
                    const formattedValue = this.formatChartValue(value);
                    ctx.fillText(formattedValue, x + (barWidth - 4) / 2, y - 5);
                }
            }
        });
        
        // Store chart instance for interactions
        this.chartInstances.set(chartId, chartInstance);
        
        // Setup interactions if enabled
        if (chartInstance.options.showTooltips) {
            this.setupChartInteractions(chartInstance);
        }
        
        // Draw labels
        this.drawLabels(ctx, data.labels, padding, barWidth, chartHeight);
        
        // Draw title
        if (data.title) {
            ctx.fillStyle = '#333';
            ctx.font = 'bold 14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(data.title, width / 2, 15);
        }
        
        // Draw Y-axis labels
        this.drawYAxisLabels(ctx, padding, chartHeight, maxValue);
    }
    
    // Draw grid lines for better readability
    static drawGridLines(ctx, padding, chartWidth, chartHeight, maxValue) {
        const gridLines = 5;
        const stepValue = maxValue / gridLines;
        
        ctx.strokeStyle = '#e9ecef';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= gridLines; i++) {
            const y = padding.top + chartHeight - (i * chartHeight / gridLines);
            
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();
        }
    }
    
    // Draw X-axis labels with rotation for long labels
    static drawLabels(ctx, labels, padding, barWidth, chartHeight) {
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        
        labels.forEach((label, index) => {
            const x = padding.left + (index * barWidth) + (barWidth / 2);
            const y = padding.top + chartHeight + 15;
            
            // Truncate long labels
            const maxLabelLength = Math.floor(barWidth / 6);
            const truncatedLabel = label.length > maxLabelLength 
                ? label.substring(0, maxLabelLength) + '...' 
                : label;
            
            ctx.fillText(truncatedLabel, x, y);
            
            // Add full label as tooltip-like text if truncated
            if (label.length > maxLabelLength) {
                ctx.font = '8px Arial';
                ctx.fillStyle = '#999';
                ctx.fillText(label, x, y + 12);
                ctx.font = '10px Arial';
                ctx.fillStyle = '#666';
            }
        });
    }
    
    // Draw Y-axis labels
    static drawYAxisLabels(ctx, padding, chartHeight, maxValue) {
        const gridLines = 5;
        
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'right';
        
        for (let i = 0; i <= gridLines; i++) {
            const value = (i * maxValue / gridLines);
            const y = padding.top + chartHeight - (i * chartHeight / gridLines);
            const formattedValue = this.formatChartValue(value);
            
            ctx.fillText(formattedValue, padding.left - 10, y + 3);
        }
    }
    
    // Render empty chart state
    static renderEmptyChart(ctx, width, height) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No data available for chart', width / 2, height / 2);
    }
    
    // Get chart data from section based on section type
    static getChartData(section) {
        if (!section || !section.rows || section.rows.length === 0) {
            return null;
        }
        
        switch (section.key) {
            case 'obj_list':
                return this.getObjListChartData(section);
            case 'list_textures':
            case 'textures':
                return this.getTextureChartData(section);
            case 'list_static_meshes':
            case 'static_meshes':
                return this.getStaticMeshChartData(section);
            case 'rhi_memory':
            case 'rendering':
                return this.getRHIMemoryChartData(section);
            default:
                return this.getGenericMemoryChartData(section);
        }
    }
    
    // Extract chart data for Obj List section
    static getObjListChartData(section) {
        // Find TotalKB column (usually last column)
        const columns = section.columns || [];
        const totalKBIndex = columns.findIndex(col => 
            /total.*kb|totalkb/i.test(col)
        );
        
        if (totalKBIndex === -1) {
            // Fallback to last numeric column
            const numericColumnIndex = this.findLastNumericColumn(section);
            if (numericColumnIndex === -1) return null;
            
            return {
                labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
                values: section.rows.slice(0, 10).map(row => parseFloat(row[numericColumnIndex]) || 0),
                title: 'Top 10 Classes by Memory Usage',
                unit: 'KB'
            };
        }
        
        return {
            labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
            values: section.rows.slice(0, 10).map(row => parseFloat(row[totalKBIndex]) || 0),
            title: 'Top 10 Classes by Total Memory (KB)',
            unit: 'KB'
        };
    }
    
    // Extract chart data for Texture section
    static getTextureChartData(section) {
        const columns = section.columns || [];
        const sizeIndex = columns.findIndex(col => 
            /size.*kb|sizekb|memory|kb/i.test(col)
        );
        
        if (sizeIndex === -1) {
            const numericColumnIndex = this.findLastNumericColumn(section);
            if (numericColumnIndex === -1) return null;
            
            return {
                labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
                values: section.rows.slice(0, 10).map(row => parseFloat(row[numericColumnIndex]) || 0),
                title: 'Top 10 Textures by Size',
                unit: 'KB'
            };
        }
        
        return {
            labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
            values: section.rows.slice(0, 10).map(row => parseFloat(row[sizeIndex]) || 0),
            title: 'Top 10 Textures by Size (KB)',
            unit: 'KB'
        };
    }
    
    // Extract chart data for Static Mesh section
    static getStaticMeshChartData(section) {
        const columns = section.columns || [];
        const sizeIndex = columns.findIndex(col => 
            /size.*kb|sizekb|memory|kb|triangles/i.test(col)
        );
        
        if (sizeIndex === -1) {
            const numericColumnIndex = this.findLastNumericColumn(section);
            if (numericColumnIndex === -1) return null;
            
            return {
                labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
                values: section.rows.slice(0, 10).map(row => parseFloat(row[numericColumnIndex]) || 0),
                title: 'Top 10 Static Meshes',
                unit: 'KB'
            };
        }
        
        const unit = /triangles/i.test(columns[sizeIndex]) ? 'Triangles' : 'KB';
        
        return {
            labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
            values: section.rows.slice(0, 10).map(row => parseFloat(row[sizeIndex]) || 0),
            title: `Top 10 Static Meshes by ${unit}`,
            unit: unit
        };
    }
    
    // Extract chart data for RHI Memory section
    static getRHIMemoryChartData(section) {
        const columns = section.columns || [];
        const memoryIndex = columns.findIndex(col => 
            /memory|size|kb|mb/i.test(col)
        );
        
        if (memoryIndex === -1) {
            const numericColumnIndex = this.findLastNumericColumn(section);
            if (numericColumnIndex === -1) return null;
            
            return {
                labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
                values: section.rows.slice(0, 10).map(row => parseFloat(row[numericColumnIndex]) || 0),
                title: 'Top 10 RHI Memory Consumers',
                unit: 'KB'
            };
        }
        
        return {
            labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
            values: section.rows.slice(0, 10).map(row => parseFloat(row[memoryIndex]) || 0),
            title: 'Top 10 RHI Memory Consumers (KB)',
            unit: 'KB'
        };
    }
    
    // Generic memory chart data extraction
    static getGenericMemoryChartData(section) {
        const numericColumnIndex = this.findLastNumericColumn(section);
        if (numericColumnIndex === -1) return null;
        
        const columns = section.columns || [];
        const columnName = columns[numericColumnIndex] || 'Value';
        
        return {
            labels: section.rows.slice(0, 10).map(row => this.truncateLabel(row[0])),
            values: section.rows.slice(0, 10).map(row => parseFloat(row[numericColumnIndex]) || 0),
            title: `Top 10 by ${columnName}`,
            unit: this.guessUnit(columnName)
        };
    }
    
    // Find the last numeric column in a section
    static findLastNumericColumn(section) {
        if (!section.rows || section.rows.length === 0) return -1;
        
        const firstRow = section.rows[0];
        for (let i = firstRow.length - 1; i >= 0; i--) {
            const value = firstRow[i];
            if (!isNaN(parseFloat(value)) && isFinite(value)) {
                return i;
            }
        }
        return -1;
    }
    
    // Truncate long labels for chart display
    static truncateLabel(label) {
        if (!label) return '';
        const str = String(label);
        return str.length > 15 ? str.substring(0, 12) + '...' : str;
    }
    
    // Guess unit from column name
    static guessUnit(columnName) {
        if (/kb/i.test(columnName)) return 'KB';
        if (/mb/i.test(columnName)) return 'MB';
        if (/bytes?/i.test(columnName)) return 'Bytes';
        if (/count|num/i.test(columnName)) return 'Count';
        if (/triangles/i.test(columnName)) return 'Triangles';
        return '';
    }
    
    // Format values for chart display
    static formatChartValue(value) {
        if (value >= 1000000) {
            return (value / 1000000).toFixed(1) + 'M';
        } else if (value >= 1000) {
            return (value / 1000).toFixed(1) + 'K';
        } else {
            return Math.round(value).toString();
        }
    }
    
    // Get bar color based on index
    static getBarColor(index) {
        const colors = [
            '#007bff', // Blue
            '#28a745', // Green
            '#ffc107', // Yellow
            '#dc3545', // Red
            '#6f42c1', // Purple
            '#fd7e14', // Orange
            '#20c997', // Teal
            '#e83e8c', // Pink
            '#6c757d', // Gray
            '#17a2b8'  // Cyan
        ];
        return colors[index % colors.length];
    }
    
    // Darken a color by a percentage
    static darkenColor(color, percent) {
        // Simple color darkening - convert hex to RGB, darken, convert back
        const hex = color.replace('#', '');
        const r = Math.max(0, parseInt(hex.substr(0, 2), 16) * (1 - percent));
        const g = Math.max(0, parseInt(hex.substr(2, 2), 16) * (1 - percent));
        const b = Math.max(0, parseInt(hex.substr(4, 2), 16) * (1 - percent));
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    // Check if section supports charts
    static supportsCharts(section) {
        if (!section || section.type !== 'table' || !section.rows || section.rows.length === 0) {
            return false;
        }
        
        // Check if section has numeric data
        const numericColumnIndex = this.findLastNumericColumn(section);
        return numericColumnIndex !== -1;
    }
    
    // Create chart canvas element with proper accessibility
    static createChartCanvas(width = 600, height = 300, title = 'Chart') {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.style.maxWidth = '100%';
        canvas.style.height = 'auto';
        
        // Accessibility attributes
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', title);
        canvas.setAttribute('tabindex', '0');
        
        return canvas;
    }
    
    // Setup chart interactions (hover, click, tooltips)
    static setupChartInteractions(chartInstance) {
        const { canvas } = chartInstance;
        
        // Create tooltip element
        const tooltip = this.createTooltip();
        document.body.appendChild(tooltip);
        
        // Mouse move handler for hover effects
        const handleMouseMove = (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            // Scale coordinates for high DPI displays
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            
            // Find hovered bar
            const hoveredBar = this.findBarAtPosition(chartInstance, scaledX, scaledY);
            
            if (hoveredBar) {
                // Show tooltip
                this.showTooltip(tooltip, event, hoveredBar, chartInstance.data.unit);
                canvas.style.cursor = 'pointer';
                
                // Highlight bar (redraw with highlight)
                this.highlightBar(chartInstance, hoveredBar.index);
            } else {
                // Hide tooltip
                this.hideTooltip(tooltip);
                canvas.style.cursor = 'default';
                
                // Remove highlight
                this.removeHighlight(chartInstance);
            }
        };
        
        // Mouse leave handler
        const handleMouseLeave = () => {
            this.hideTooltip(tooltip);
            canvas.style.cursor = 'default';
            this.removeHighlight(chartInstance);
        };
        
        // Click handler for bar interactions
        const handleClick = (event) => {
            const rect = canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const scaledX = x * scaleX;
            const scaledY = y * scaleY;
            
            const clickedBar = this.findBarAtPosition(chartInstance, scaledX, scaledY);
            
            if (clickedBar) {
                // Dispatch custom event for bar click
                const barClickEvent = new CustomEvent('chartBarClick', {
                    detail: {
                        bar: clickedBar,
                        chartData: chartInstance.data,
                        chartId: canvas.id
                    }
                });
                canvas.dispatchEvent(barClickEvent);
                
                // Show detailed info (could be expanded)
                console.log('Bar clicked:', clickedBar);
            }
        };
        
        // Add event listeners
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseleave', handleMouseLeave);
        canvas.addEventListener('click', handleClick);
        
        // Store event handlers for cleanup
        chartInstance.eventHandlers = {
            mousemove: handleMouseMove,
            mouseleave: handleMouseLeave,
            click: handleClick,
            tooltip
        };
    }
    
    // Create tooltip element
    static createTooltip() {
        const tooltip = document.createElement('div');
        tooltip.className = 'chart-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 8px 12px;
            border-radius: 4px;
            font-size: 12px;
            pointer-events: none;
            z-index: 1000;
            display: none;
            max-width: 200px;
            word-wrap: break-word;
        `;
        return tooltip;
    }
    
    // Find bar at given position
    static findBarAtPosition(chartInstance, x, y) {
        return chartInstance.bars.find(bar => 
            x >= bar.x && x <= bar.x + bar.width &&
            y >= bar.y && y <= bar.y + bar.height
        );
    }
    
    // Show tooltip with bar information
    static showTooltip(tooltip, event, bar, unit = '') {
        const formattedValue = this.formatChartValue(bar.value);
        tooltip.innerHTML = `
            <strong>${bar.label}</strong><br>
            Value: ${formattedValue}${unit ? ' ' + unit : ''}
        `;
        
        tooltip.style.display = 'block';
        tooltip.style.left = (event.pageX + 10) + 'px';
        tooltip.style.top = (event.pageY - 10) + 'px';
        
        // Adjust position if tooltip goes off screen
        const rect = tooltip.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            tooltip.style.left = (event.pageX - rect.width - 10) + 'px';
        }
        if (rect.top < 0) {
            tooltip.style.top = (event.pageY + 20) + 'px';
        }
    }
    
    // Hide tooltip
    static hideTooltip(tooltip) {
        tooltip.style.display = 'none';
    }
    
    // Highlight a specific bar
    static highlightBar(chartInstance, barIndex) {
        const { canvas, data, options, padding, barWidth, chartHeight, maxValue } = chartInstance;
        const ctx = canvas.getContext('2d');
        
        // Redraw the specific bar with highlight
        const bar = chartInstance.bars[barIndex];
        if (!bar) return;
        
        // Save current state
        ctx.save();
        
        // Clear the bar area
        ctx.clearRect(bar.x - 2, bar.y - 2, bar.width + 4, bar.height + 4);
        
        // Redraw with highlight effect
        const baseColor = options.colors?.[barIndex] || this.getBarColor(barIndex);
        const highlightColor = this.lightenColor(baseColor, 0.3);
        
        // Highlighted bar with glow effect
        ctx.shadowColor = highlightColor;
        ctx.shadowBlur = 8;
        ctx.fillStyle = highlightColor;
        ctx.fillRect(bar.x, bar.y, bar.width, bar.height);
        
        // Border
        ctx.shadowBlur = 0;
        ctx.strokeStyle = this.darkenColor(baseColor, 0.3);
        ctx.lineWidth = 2;
        ctx.strokeRect(bar.x, bar.y, bar.width, bar.height);
        
        ctx.restore();
    }
    
    // Remove highlight (redraw original bar)
    static removeHighlight(chartInstance) {
        // Simple approach: redraw the entire chart
        // For better performance, could track and redraw only highlighted bars
        const { canvas, data, options } = chartInstance;
        this.renderBarChart(canvas, data, options);
    }
    
    // Lighten a color by a percentage
    static lightenColor(color, percent) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) * (1 + percent));
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) * (1 + percent));
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) * (1 + percent));
        
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }
    
    // Export chart as PNG
    static exportChartAsPNG(chartId, filename = 'chart.png') {
        const chartInstance = this.chartInstances.get(chartId);
        if (!chartInstance) {
            console.error('Chart instance not found:', chartId);
            return;
        }
        
        const { canvas } = chartInstance;
        
        // Create download link
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 'image/png');
    }
    
    // Export chart as SVG
    static exportChartAsSVG(chartId, filename = 'chart.svg') {
        const chartInstance = this.chartInstances.get(chartId);
        if (!chartInstance) {
            console.error('Chart instance not found:', chartId);
            return;
        }
        
        const { data, options, padding, barWidth, chartHeight, maxValue } = chartInstance;
        const { canvas } = chartInstance;
        const { width, height } = canvas;
        
        // Create SVG content
        let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <rect width="100%" height="100%" fill="${options.backgroundColor || '#f8f9fa'}"/>
`;
        
        // Add title
        if (data.title) {
            svgContent += `    <text x="${width / 2}" y="15" text-anchor="middle" font-family="Arial" font-size="14" font-weight="bold" fill="#333">${data.title}</text>\n`;
        }
        
        // Add bars
        data.values.forEach((value, index) => {
            if (value > 0) {
                const barHeight = (value / maxValue) * chartHeight;
                const x = padding.left + (index * barWidth) + 2;
                const y = padding.top + chartHeight - barHeight;
                const color = options.colors?.[index] || this.getBarColor(index);
                
                svgContent += `    <rect x="${x}" y="${y}" width="${barWidth - 4}" height="${barHeight}" fill="${color}" stroke="${this.darkenColor(color, 0.3)}" stroke-width="1"/>\n`;
                
                // Add value label
                if (barHeight > 20 && options.showValues) {
                    const formattedValue = this.formatChartValue(value);
                    svgContent += `    <text x="${x + (barWidth - 4) / 2}" y="${y - 5}" text-anchor="middle" font-family="Arial" font-size="10" fill="#333">${formattedValue}</text>\n`;
                }
            }
        });
        
        // Add X-axis labels
        data.labels.forEach((label, index) => {
            const x = padding.left + (index * barWidth) + (barWidth / 2);
            const y = padding.top + chartHeight + 15;
            const maxLabelLength = Math.floor(barWidth / 6);
            const truncatedLabel = label.length > maxLabelLength 
                ? label.substring(0, maxLabelLength) + '...' 
                : label;
            
            svgContent += `    <text x="${x}" y="${y}" text-anchor="middle" font-family="Arial" font-size="10" fill="#666">${truncatedLabel}</text>\n`;
        });
        
        // Add Y-axis labels
        const gridLines = 5;
        for (let i = 0; i <= gridLines; i++) {
            const value = (i * maxValue / gridLines);
            const y = padding.top + chartHeight - (i * chartHeight / gridLines);
            const formattedValue = this.formatChartValue(value);
            
            svgContent += `    <text x="${padding.left - 10}" y="${y + 3}" text-anchor="end" font-family="Arial" font-size="10" fill="#666">${formattedValue}</text>\n`;
        }
        
        svgContent += '</svg>';
        
        // Create download
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    // Create chart configuration panel
    static createConfigPanel(chartId, onConfigChange) {
        const chartInstance = this.chartInstances.get(chartId);
        if (!chartInstance) return null;
        
        const panel = document.createElement('div');
        panel.className = 'chart-config-panel mt-2 p-3 border rounded';
        panel.style.backgroundColor = '#f8f9fa';
        
        panel.innerHTML = `
            <h6 class="mb-3">Chart Configuration</h6>
            <div class="row">
                <div class="col-md-6">
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="showTooltips-${chartId}" ${chartInstance.options.showTooltips ? 'checked' : ''}>
                        <label class="form-check-label" for="showTooltips-${chartId}">Show Tooltips</label>
                    </div>
                    <div class="form-check">
                        <input class="form-check-input" type="checkbox" id="showValues-${chartId}" ${chartInstance.options.showValues ? 'checked' : ''}>
                        <label class="form-check-label" for="showValues-${chartId}">Show Values on Bars</label>
                    </div>
                </div>
                <div class="col-md-6">
                    <label for="colorScheme-${chartId}" class="form-label">Color Scheme:</label>
                    <select class="form-select form-select-sm" id="colorScheme-${chartId}">
                        <option value="default">Default</option>
                        <option value="blue">Blue Tones</option>
                        <option value="green">Green Tones</option>
                        <option value="warm">Warm Colors</option>
                        <option value="cool">Cool Colors</option>
                    </select>
                </div>
            </div>
            <div class="mt-3">
                <button class="btn btn-sm btn-primary me-2" onclick="MemReportCharts.applyConfig('${chartId}')">Apply Changes</button>
                <button class="btn btn-sm btn-outline-secondary me-2" onclick="MemReportCharts.toggleConfigPanel('${chartId}')">Close</button>
            </div>
        `;
        
        return panel;
    }
    
    // Apply configuration changes
    static applyConfig(chartId) {
        const chartInstance = this.chartInstances.get(chartId);
        if (!chartInstance) return;
        
        // Get new configuration values
        const showTooltips = document.getElementById(`showTooltips-${chartId}`).checked;
        const showValues = document.getElementById(`showValues-${chartId}`).checked;
        const colorScheme = document.getElementById(`colorScheme-${chartId}`).value;
        
        // Update options
        chartInstance.options.showTooltips = showTooltips;
        chartInstance.options.showValues = showValues;
        chartInstance.options.colors = this.getColorScheme(colorScheme);
        
        // Re-setup interactions if needed
        if (showTooltips && !chartInstance.eventHandlers) {
            this.setupChartInteractions(chartInstance);
        } else if (!showTooltips && chartInstance.eventHandlers) {
            this.removeChartInteractions(chartInstance);
        }
        
        // Redraw chart
        this.renderBarChart(chartInstance.canvas, chartInstance.data, chartInstance.options);
        
        // Show feedback
        const feedback = document.createElement('div');
        feedback.className = 'alert alert-success alert-dismissible fade show mt-2';
        feedback.innerHTML = `
            Configuration applied successfully!
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        const configPanel = document.querySelector(`#chart-config-${chartId}`);
        if (configPanel) {
            configPanel.appendChild(feedback);
            setTimeout(() => feedback.remove(), 3000);
        }
    }
    
    // Get color scheme
    static getColorScheme(scheme) {
        const schemes = {
            default: ['#007bff', '#28a745', '#ffc107', '#dc3545', '#6f42c1', '#fd7e14', '#20c997', '#e83e8c', '#6c757d', '#17a2b8'],
            blue: ['#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107', '#198754', '#20c997', '#0dcaf0'],
            green: ['#198754', '#20c997', '#0dcaf0', '#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107'],
            warm: ['#dc3545', '#fd7e14', '#ffc107', '#d63384', '#6f42c1', '#6610f2', '#0d6efd', '#0dcaf0', '#20c997', '#198754'],
            cool: ['#0dcaf0', '#20c997', '#198754', '#0d6efd', '#6610f2', '#6f42c1', '#d63384', '#dc3545', '#fd7e14', '#ffc107']
        };
        return schemes[scheme] || schemes.default;
    }
    
    // Toggle configuration panel
    static toggleConfigPanel(chartId) {
        const configPanel = document.querySelector(`#chart-config-${chartId}`);
        if (configPanel) {
            configPanel.style.display = configPanel.style.display === 'none' ? 'block' : 'none';
        }
    }
    
    // Remove chart interactions
    static removeChartInteractions(chartInstance) {
        if (!chartInstance.eventHandlers) return;
        
        const { canvas } = chartInstance;
        const { mousemove, mouseleave, click, tooltip } = chartInstance.eventHandlers;
        
        canvas.removeEventListener('mousemove', mousemove);
        canvas.removeEventListener('mouseleave', mouseleave);
        canvas.removeEventListener('click', click);
        
        if (tooltip && tooltip.parentNode) {
            tooltip.parentNode.removeChild(tooltip);
        }
        
        delete chartInstance.eventHandlers;
    }
    
    // Cleanup chart instance
    static cleanupChart(chartId) {
        const chartInstance = this.chartInstances.get(chartId);
        if (chartInstance) {
            this.removeChartInteractions(chartInstance);
            this.chartInstances.delete(chartId);
        }
    }
    
    // Create chart container with toggle functionality
    static createChartContainer(section, onToggle) {
        const container = document.createElement('div');
        container.className = 'chart-container mt-3';
        container.style.display = 'none'; // Initially hidden
        
        // Chart header with controls
        const header = document.createElement('div');
        header.className = 'd-flex justify-content-between align-items-center mb-2';
        
        const title = document.createElement('h6');
        title.className = 'mb-0';
        title.textContent = 'Memory Usage Chart';
        
        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'btn-group btn-group-sm';
        
        // Configuration button
        const configButton = document.createElement('button');
        configButton.className = 'btn btn-outline-secondary';
        configButton.innerHTML = '⚙️';
        configButton.title = 'Chart configuration';
        configButton.setAttribute('aria-label', 'Chart configuration');
        
        // Export dropdown
        const exportDropdown = document.createElement('div');
        exportDropdown.className = 'dropdown';
        exportDropdown.innerHTML = `
            <button class="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Export chart">
                📊
            </button>
            <ul class="dropdown-menu">
                <li><a class="dropdown-item export-png" href="#">Export as PNG</a></li>
                <li><a class="dropdown-item export-svg" href="#">Export as SVG</a></li>
            </ul>
        `;
        
        // Close button
        const closeButton = document.createElement('button');
        closeButton.className = 'btn btn-outline-secondary';
        closeButton.innerHTML = '✕';
        closeButton.title = 'Hide chart';
        closeButton.setAttribute('aria-label', 'Hide chart');
        closeButton.addEventListener('click', () => {
            container.style.display = 'none';
            if (onToggle) onToggle(false);
        });
        
        buttonGroup.appendChild(configButton);
        buttonGroup.appendChild(exportDropdown);
        buttonGroup.appendChild(closeButton);
        
        header.appendChild(title);
        header.appendChild(buttonGroup);
        container.appendChild(header);
        
        return container;
    }
}

// Export for use in other modules
window.MemReportCharts = MemReportCharts;