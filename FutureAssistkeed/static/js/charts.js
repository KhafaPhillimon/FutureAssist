// Chart utilities and configurations for FutureAssist
// Handles all Chart.js implementations with Botswana-specific styling

// Chart.js default configuration
Chart.defaults.font.family = "'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
Chart.defaults.font.size = 14;
Chart.defaults.color = '#6c757d';
Chart.defaults.responsive = true;
Chart.defaults.maintainAspectRatio = false;

// Botswana-inspired color palette for charts
const CHART_COLORS = {
    primary: '#0a4d68',
    primaryLight: '#3d8fb3',
    primaryDark: '#003d52',
    secondary: '#ffcc00',
    secondaryLight: '#ffe066',
    secondaryDark: '#b38f00',
    success: '#228B22',
    danger: '#e74c3c',
    warning: '#f39c12',
    info: '#3498db',
    light: '#F5F7FA',
    dark: '#2C3E50',
    muted: '#6c757d'
};

// Chart color schemes
const COLOR_SCHEMES = {
    income: [CHART_COLORS.success, '#27ae60', '#2ecc71', '#58d68d', '#82e0aa'],
    expense: [CHART_COLORS.danger, '#ec7063', '#f1948a', '#f5b7b1', '#fadbd8'],
    forecast: [CHART_COLORS.primary, CHART_COLORS.primaryLight, CHART_COLORS.info, CHART_COLORS.warning],
    mixed: [CHART_COLORS.primary, CHART_COLORS.secondary, CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.warning, CHART_COLORS.info]
};

// Chart utility functions
function getResponsiveChartOptions(type = 'line') {
    const baseOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
            mode: 'index',
            intersect: false,
        },
        plugins: {
            legend: {
                display: true,
                position: 'top',
                labels: {
                    usePointStyle: true,
                    padding: 20,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: CHART_COLORS.primary,
                borderWidth: 1,
                cornerRadius: 8,
                displayColors: true,
                callbacks: {
                    title: function(context) {
                        return context[0].label;
                    },
                    beforeBody: function(context) {
                        return null;
                    },
                    afterBody: function(context) {
                        return null;
                    }
                }
            }
        },
        scales: {}
    };
    
    // Add appropriate scales based on chart type
    if (type === 'line' || type === 'bar') {
        baseOptions.scales = {
            x: {
                display: true,
                grid: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    font: {
                        size: 11
                    }
                }
            },
            y: {
                display: true,
                grid: {
                    display: true,
                    color: 'rgba(0, 0, 0, 0.1)'
                },
                ticks: {
                    font: {
                        size: 11
                    },
                    callback: function(value) {
                        return 'BWP ' + value.toLocaleString();
                    }
                }
            }
        };
    }
    
    return baseOptions;
}

// Balance forecast chart
function createBalanceForecastChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    
    const chartData = {
        labels: data.labels,
        datasets: [{
            label: 'Predicted Balance',
            data: data.balances,
            borderColor: CHART_COLORS.primary,
            backgroundColor: CHART_COLORS.primary + '20',
            borderWidth: 3,
            fill: true,
            tension: 0.4,
            pointBackgroundColor: data.balances.map(balance => 
                balance >= 0 ? CHART_COLORS.success : CHART_COLORS.danger
            ),
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 6,
            pointHoverRadius: 8
        }]
    };
    
    if (data.confidence) {
        chartData.datasets.push({
            label: 'Confidence %',
            data: data.confidence,
            borderColor: CHART_COLORS.warning,
            backgroundColor: 'transparent',
            borderWidth: 2,
            fill: false,
            tension: 0.4,
            yAxisID: 'y1',
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }
    
    const options = getResponsiveChartOptions('line');
    
    // Add zero line styling
    options.scales.y.grid.color = function(context) {
        if (context.tick.value === 0) {
            return CHART_COLORS.danger;
        }
        return 'rgba(0, 0, 0, 0.1)';
    };
    
    // Add second y-axis for confidence if present
    if (data.confidence) {
        options.scales.y1 = {
            type: 'linear',
            display: true,
            position: 'right',
            min: 0,
            max: 100,
            grid: {
                drawOnChartArea: false,
            },
            ticks: {
                callback: function(value) {
                    return value + '%';
                }
            }
        };
    }
    
    // Custom tooltip for balance chart
    options.plugins.tooltip.callbacks.label = function(context) {
        if (context.datasetIndex === 0) {
            const value = context.parsed.y;
            const sign = value >= 0 ? '+' : '-';
            return `Balance: ${sign}BWP ${Math.abs(value).toFixed(2)}`;
        } else {
            return `Confidence: ${context.parsed.y.toFixed(1)}%`;
        }
    };
    
    return new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: options
    });
}

// Cash flow chart (income vs expenses)
function createCashFlowChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    
    const chartData = {
        labels: data.labels,
        datasets: [{
            label: 'Income',
            data: data.income,
            backgroundColor: CHART_COLORS.success + 'CC',
            borderColor: CHART_COLORS.success,
            borderWidth: 1
        }, {
            label: 'Expenses',
            data: data.expenses.map(exp => -Math.abs(exp)), // Ensure expenses are negative
            backgroundColor: CHART_COLORS.danger + 'CC',
            borderColor: CHART_COLORS.danger,
            borderWidth: 1
        }]
    };
    
    if (data.netFlow) {
        chartData.datasets.push({
            label: 'Net Flow',
            data: data.netFlow,
            type: 'line',
            borderColor: CHART_COLORS.warning,
            backgroundColor: 'transparent',
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointRadius: 6,
            pointHoverRadius: 8,
            pointBackgroundColor: CHART_COLORS.warning,
            pointBorderColor: '#fff',
            pointBorderWidth: 2
        });
    }
    
    const options = getResponsiveChartOptions('bar');
    
    // Custom tooltip for cash flow
    options.plugins.tooltip.callbacks.label = function(context) {
        const value = Math.abs(context.parsed.y);
        const label = context.dataset.label;
        
        if (label === 'Net Flow') {
            const sign = context.parsed.y >= 0 ? '+' : '-';
            return `${label}: ${sign}BWP ${value.toFixed(2)}`;
        } else {
            return `${label}: BWP ${value.toFixed(2)}`;
        }
    };
    
    return new Chart(ctx, {
        type: 'bar',
        data: chartData,
        options: options
    });
}

// Category breakdown pie chart
function createCategoryChart(canvasId, data, type = 'doughnut') {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    
    const chartData = {
        labels: data.labels,
        datasets: [{
            data: data.values,
            backgroundColor: data.colors || COLOR_SCHEMES.mixed,
            borderColor: '#fff',
            borderWidth: 2,
            hoverBorderWidth: 3
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                position: 'bottom',
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                borderColor: CHART_COLORS.primary,
                borderWidth: 1,
                cornerRadius: 8,
                callbacks: {
                    label: function(context) {
                        const label = context.label || '';
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a, b) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: BWP ${value.toFixed(2)} (${percentage}%)`;
                    }
                }
            }
        },
        cutout: type === 'doughnut' ? '50%' : 0
    };
    
    return new Chart(ctx, {
        type: type,
        data: chartData,
        options: options
    });
}

// Trend line chart for income/expense patterns
function createTrendChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    
    const datasets = [];
    
    if (data.income) {
        datasets.push({
            label: 'Income Trend',
            data: data.income,
            borderColor: CHART_COLORS.success,
            backgroundColor: CHART_COLORS.success + '20',
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }
    
    if (data.expenses) {
        datasets.push({
            label: 'Expense Trend',
            data: data.expenses,
            borderColor: CHART_COLORS.danger,
            backgroundColor: CHART_COLORS.danger + '20',
            borderWidth: 3,
            fill: false,
            tension: 0.4,
            pointRadius: 4,
            pointHoverRadius: 6
        });
    }
    
    const chartData = {
        labels: data.labels,
        datasets: datasets
    };
    
    const options = getResponsiveChartOptions('line');
    options.plugins.tooltip.callbacks.label = function(context) {
        const value = context.parsed.y;
        return `${context.dataset.label}: BWP ${value.toFixed(2)}`;
    };
    
    return new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: options
    });
}

// Mini spark line chart for dashboard widgets
function createSparklineChart(canvasId, data, color = CHART_COLORS.primary) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    
    const chartData = {
        labels: data.labels,
        datasets: [{
            data: data.values,
            borderColor: color,
            backgroundColor: color + '30',
            borderWidth: 2,
            fill: true,
            tension: 0.4,
            pointRadius: 0,
            pointHoverRadius: 4
        }]
    };
    
    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            tooltip: {
                enabled: false
            }
        },
        scales: {
            x: {
                display: false
            },
            y: {
                display: false
            }
        },
        elements: {
            point: {
                hoverRadius: 0
            }
        }
    };
    
    return new Chart(ctx, {
        type: 'line',
        data: chartData,
        options: options
    });
}

// Utility function to destroy chart if it exists
function destroyChart(chartInstance) {
    if (chartInstance && typeof chartInstance.destroy === 'function') {
        chartInstance.destroy();
        return null;
    }
    return chartInstance;
}

// Utility function to update chart data
function updateChartData(chartInstance, newData) {
    if (!chartInstance) return;
    
    chartInstance.data.labels = newData.labels;
    chartInstance.data.datasets.forEach((dataset, index) => {
        if (newData.datasets[index]) {
            dataset.data = newData.datasets[index].data;
        }
    });
    
    chartInstance.update('none'); // No animation for updates
}

// Export chart functions for global use
window.ChartUtils = {
    CHART_COLORS,
    COLOR_SCHEMES,
    createBalanceForecastChart,
    createCashFlowChart,
    createCategoryChart,
    createTrendChart,
    createSparklineChart,
    destroyChart,
    updateChartData,
    getResponsiveChartOptions
};

// Handle chart responsiveness on window resize
let resizeTimeout;
window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
        Chart.instances.forEach(function(chart) {
            chart.resize();
        });
    }, 250);
});

// Handle dark mode chart color adjustments
function updateChartsForTheme(isDark) {
    const textColor = isDark ? '#e9ecef' : '#6c757d';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    
    Chart.defaults.color = textColor;
    Chart.defaults.borderColor = gridColor;
    Chart.defaults.backgroundColor = 'transparent';
    
    // Update existing charts
    Chart.instances.forEach(function(chart) {
        if (chart.options.scales) {
            Object.keys(chart.options.scales).forEach(scaleKey => {
                if (chart.options.scales[scaleKey].grid) {
                    chart.options.scales[scaleKey].grid.color = gridColor;
                }
                if (chart.options.scales[scaleKey].ticks) {
                    chart.options.scales[scaleKey].ticks.color = textColor;
                }
            });
        }
        chart.update('none');
    });
}

// Detect system dark mode preference
if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    updateChartsForTheme(true);
}

// Listen for dark mode changes
if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        updateChartsForTheme(e.matches);
    });
}

console.log('Charts.js initialized successfully');
