/**
 * Dashboard JavaScript for Financial Tracker
 * Handles chart initialization and dynamic updates
 */

// Global chart variables
let balanceChart = null;
let expenseChart = null;

/**
 * Initialize dashboard charts
 */
function initializeDashboardCharts() {
    fetchChartData()
        .then(data => {
            if (data && !data.error) {
                initializeBalanceChart(data.balance_trend);
                initializeExpenseChart(data.expense_categories);
            } else {
                console.error('Error loading chart data:', data?.error || 'Unknown error');
                showChartError();
            }
        })
        .catch(error => {
            console.error('Error fetching chart data:', error);
            showChartError();
        });
}

/**
 * Fetch chart data from the API
 */
async function fetchChartData() {
    try {
        const response = await fetch('/api/chart_data');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Fetch error:', error);
        return { error: error.message };
    }
}

/**
 * Initialize the balance trend chart
 */
function initializeBalanceChart(balanceData) {
    const ctx = document.getElementById('balanceChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (balanceChart) {
        balanceChart.destroy();
    }

    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: balanceData.labels,
            datasets: [{
                label: 'Balance',
                data: balanceData.data,
                borderColor: 'rgb(59, 130, 246)',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointBackgroundColor: 'rgb(59, 130, 246)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return `Balance: P${context.parsed.y.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        display: false
                    },
                    ticks: {
                        maxTicksLimit: 8
                    }
                },
                y: {
                    beginAtZero: false,
                    grid: {
                        color: 'rgba(255, 255, 255, 0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return 'P' + value.toFixed(0);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                line: {
                    tension: 0.4
                }
            }
        }
    });
}

/**
 * Initialize the expense category pie chart
 */
function initializeExpenseChart(expenseData) {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (expenseChart) {
        expenseChart.destroy();
    }

    // Check if there's data to display
    if (!expenseData.labels || expenseData.labels.length === 0) {
        showNoExpenseData(ctx);
        return;
    }

    // Generate colors for categories
    const colors = generateColors(expenseData.labels.length);

    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: expenseData.labels.map(label => formatCategoryName(label)),
            datasets: [{
                data: expenseData.data,
                backgroundColor: colors,
                borderColor: '#fff',
                borderWidth: 2,
                hoverBorderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgb(255, 255, 255)',
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: P${context.parsed.toFixed(2)} (${percentage}%)`;
                        }
                    }
                }
            },
            cutout: '60%',
            animation: {
                animateRotate: true,
                duration: 1000
            }
        }
    });
}

/**
 * Show error message when charts fail to load
 */
function showChartError() {
    const balanceCanvas = document.getElementById('balanceChart');
    const expenseCanvas = document.getElementById('expenseChart');

    if (balanceCanvas) {
        showErrorMessage(balanceCanvas, 'Unable to load balance chart');
    }

    if (expenseCanvas) {
        showErrorMessage(expenseCanvas, 'Unable to load expense chart');
    }
}

/**
 * Show no data message for expense chart
 */
function showNoExpenseData(canvas) {
    const ctx = canvas.getContext('2d');
    const parent = canvas.parentElement;
    
    // Create no data message
    const noDataMsg = document.createElement('div');
    noDataMsg.className = 'text-center text-muted py-4';
    noDataMsg.innerHTML = `
        <i class="fas fa-chart-pie fa-3x mb-3 opacity-50"></i>
        <p class="mb-0">No expense data for this month</p>
        <small>Add some expense transactions to see the breakdown</small>
    `;
    
    // Hide canvas and show message
    canvas.style.display = 'none';
    parent.appendChild(noDataMsg);
}

/**
 * Show error message in chart container
 */
function showErrorMessage(canvas, message) {
    const parent = canvas.parentElement;
    
    const errorMsg = document.createElement('div');
    errorMsg.className = 'text-center text-danger py-4';
    errorMsg.innerHTML = `
        <i class="fas fa-exclamation-triangle fa-2x mb-3"></i>
        <p class="mb-0">${message}</p>
        <small>Please refresh the page to try again</small>
    `;
    
    canvas.style.display = 'none';
    parent.appendChild(errorMsg);
}

/**
 * Generate colors for chart segments
 */
function generateColors(count) {
    const colors = [
        'rgb(59, 130, 246)',   // Blue
        'rgb(34, 197, 94)',    // Green
        'rgb(239, 68, 68)',    // Red
        'rgb(245, 158, 11)',   // Amber
        'rgb(168, 85, 247)',   // Purple
        'rgb(236, 72, 153)',   // Pink
        'rgb(14, 165, 233)',   // Sky
        'rgb(34, 197, 94)',    // Emerald
        'rgb(249, 115, 22)',   // Orange
        'rgb(139, 92, 246)'    // Violet
    ];
    
    const result = [];
    for (let i = 0; i < count; i++) {
        result.push(colors[i % colors.length]);
    }
    return result;
}

/**
 * Format category names for display
 */
function formatCategoryName(name) {
    return name.replace(/_/g, ' ')
              .split(' ')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
}

/**
 * Refresh charts (can be called externally)
 */
function refreshCharts() {
    initializeDashboardCharts();
}

/**
 * Utility function to format currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-BW', {
        style: 'currency',
        currency: 'BWP'
    }).format(amount);
}

// Initialize charts when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Only initialize charts if we're on the dashboard page
    if (document.getElementById('balanceChart') || document.getElementById('expenseChart')) {
        initializeDashboardCharts();
    }
});

// Refresh charts when window is resized
window.addEventListener('resize', function() {
    if (balanceChart) {
        balanceChart.resize();
    }
    if (expenseChart) {
        expenseChart.resize();
    }
});
