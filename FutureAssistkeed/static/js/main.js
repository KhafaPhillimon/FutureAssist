// Main JavaScript file for FutureAssist
// Handles global functionality, utilities, and common interactions

// Global variables
let toastContainer;
let speechSynthesis;
let currentUser = null;

// Initialize app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize toast container
    initializeToasts();
    
    // Initialize speech synthesis
    initializeSpeechSynthesis();
    
    // Setup global event listeners
    setupGlobalEventListeners();
    
    // Load user preferences
    loadUserPreferences();
    
    // Check for updates
    checkForUpdates();
    
    // Initialize offline detection
    initializeOfflineDetection();
    
    console.log('FutureAssist initialized successfully');
}

// Toast notifications
function initializeToasts() {
    toastContainer = document.querySelector('.toast-container');
    if (!toastContainer) {
        // Create toast container if it doesn't exist
        toastContainer = document.createElement('div');
        toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        toastContainer.style.zIndex = '11';
        document.body.appendChild(toastContainer);
    }
}

function showToast(message, type = 'info', duration = 5000) {
    const toastId = 'toast-' + Date.now();
    const iconMap = {
        'success': 'check-circle',
        'error': 'exclamation-triangle',
        'warning': 'exclamation-circle',
        'info': 'info-circle'
    };
    
    const colorMap = {
        'success': 'text-success',
        'error': 'text-danger',
        'warning': 'text-warning',
        'info': 'text-primary'
    };
    
    const toastHTML = `
        <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true" data-bs-delay="${duration}">
            <div class="toast-header">
                <i class="fas fa-${iconMap[type]} ${colorMap[type]} me-2"></i>
                <strong class="me-auto">FutureAssist</strong>
                <small class="text-muted">now</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${message}
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement);
    
    // Auto-remove toast element after it's hidden
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
    
    toast.show();
    
    // Speak the message if voice is enabled
    if (isVoiceEnabled()) {
        speak(message);
    }
}

// Speech synthesis
function initializeSpeechSynthesis() {
    if ('speechSynthesis' in window) {
        speechSynthesis = window.speechSynthesis;
    }
}

function speak(text, options = {}) {
    if (!speechSynthesis || !isVoiceEnabled()) return;
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = options.rate || getUserPreference('speechRate', 1.0);
    utterance.pitch = options.pitch || 1.0;
    utterance.volume = options.volume || 1.0;
    
    // Use English voice for Botswana context
    const voices = speechSynthesis.getVoices();
    const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
    if (englishVoice) {
        utterance.voice = englishVoice;
    }
    
    speechSynthesis.speak(utterance);
}

function isVoiceEnabled() {
    return getUserPreference('voiceEnabled', false);
}

// User preferences
function loadUserPreferences() {
    const preferences = JSON.parse(localStorage.getItem('futureassist_preferences') || '{}');
    
    // Apply accessibility preferences
    if (preferences.highContrast) {
        document.body.classList.add('high-contrast');
    }
    
    if (preferences.largeText) {
        document.body.classList.add('large-text');
    }
    
    if (preferences.fontSize) {
        document.documentElement.style.setProperty('--base-font-size', preferences.fontSize + 'px');
    }
    
    if (preferences.reducedMotion) {
        document.documentElement.style.setProperty('--transition', 'none');
        document.documentElement.style.setProperty('--transition-fast', 'none');
    }
}

function saveUserPreference(key, value) {
    const preferences = JSON.parse(localStorage.getItem('futureassist_preferences') || '{}');
    preferences[key] = value;
    localStorage.setItem('futureassist_preferences', JSON.stringify(preferences));
}

function getUserPreference(key, defaultValue = null) {
    const preferences = JSON.parse(localStorage.getItem('futureassist_preferences') || '{}');
    return preferences[key] !== undefined ? preferences[key] : defaultValue;
}

// Global event listeners
function setupGlobalEventListeners() {
    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);
    
    // Form validation
    document.addEventListener('submit', handleFormSubmission);
    
    // Click tracking for analytics (if enabled)
    if (getUserPreference('analytics', true)) {
        document.addEventListener('click', trackUserInteraction);
    }
    
    // Prevent form submission on Enter in search fields
    document.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && e.target.type === 'search') {
            e.preventDefault();
        }
    });
}

function handleKeyboardShortcuts(e) {
    // Alt + key combinations for accessibility
    if (e.altKey) {
        switch (e.key) {
            case 'h': // Alt + H: Go to home/dashboard
                e.preventDefault();
                window.location.href = '/';
                break;
            case 't': // Alt + T: Go to transactions
                e.preventDefault();
                window.location.href = '/transactions';
                break;
            case 'f': // Alt + F: Go to forecast
                e.preventDefault();
                window.location.href = '/forecast';
                break;
            case 's': // Alt + S: Go to settings
                e.preventDefault();
                window.location.href = '/settings';
                break;
            case 'a': // Alt + A: Add transaction
                e.preventDefault();
                if (typeof showAddTransactionModal === 'function') {
                    showAddTransactionModal();
                }
                break;
            case 'v': // Alt + V: Toggle voice
                e.preventDefault();
                toggleVoice();
                break;
        }
    }
    
    // Escape key to close modals
    if (e.key === 'Escape') {
        const activeModal = document.querySelector('.modal.show');
        if (activeModal) {
            const modal = bootstrap.Modal.getInstance(activeModal);
            if (modal) modal.hide();
        }
    }
}

function handleFormSubmission(e) {
    const form = e.target;
    if (!form.checkValidity()) {
        e.preventDefault();
        e.stopPropagation();
        showToast('Please fill in all required fields correctly', 'warning');
    }
    form.classList.add('was-validated');
}

function trackUserInteraction(e) {
    // Simple analytics tracking
    const element = e.target;
    const action = element.getAttribute('data-track') || element.textContent?.slice(0, 50);
    const category = element.closest('[data-track-category]')?.getAttribute('data-track-category') || 'general';
    
    if (action) {
        console.log('User interaction:', { category, action, timestamp: new Date().toISOString() });
        // In a real app, this would send data to an analytics service
    }
}

// Accessibility functions
function toggleAccessibility() {
    const body = document.body;
    const isHighContrast = body.classList.contains('high-contrast');
    
    if (isHighContrast) {
        body.classList.remove('high-contrast');
        saveUserPreference('highContrast', false);
        showToast('High contrast mode disabled', 'info');
    } else {
        body.classList.add('high-contrast');
        saveUserPreference('highContrast', true);
        showToast('High contrast mode enabled', 'info');
    }
}

function toggleVoice() {
    const currentState = isVoiceEnabled();
    const newState = !currentState;
    
    saveUserPreference('voiceEnabled', newState);
    
    if (newState) {
        showToast('Voice assistance enabled', 'success');
        speak('Voice assistance is now enabled. I will read important information to you.');
    } else {
        showToast('Voice assistance disabled', 'info');
    }
}

// Utility functions
function formatCurrency(amount, currency = 'BWP') {
    return new Intl.NumberFormat('en-BW', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2
    }).format(Math.abs(amount));
}

function formatDate(date, format = 'short') {
    const d = new Date(date);
    const userFormat = getUserPreference('dateFormat', 'DD/MM/YYYY');
    
    const options = {
        'short': { day: '2-digit', month: '2-digit', year: 'numeric' },
        'long': { day: '2-digit', month: 'long', year: 'numeric' },
        'relative': { day: 'numeric', month: 'short' }
    };
    
    if (format === 'relative') {
        const now = new Date();
        const diffTime = d.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0 && diffDays <= 7) return `In ${diffDays} days`;
        if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)} days ago`;
    }
    
    return d.toLocaleDateString('en-BW', options[format] || options.short);
}

function debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func.apply(this, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(this, args);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

// API helper functions
async function apiRequest(url, options = {}) {
    const defaultOptions = {
        headers: {
            'Content-Type': 'application/json',
        },
    };
    
    const mergedOptions = { ...defaultOptions, ...options };
    
    try {
        const response = await fetch(url, mergedOptions);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('API request failed:', error);
        
        if (!navigator.onLine) {
            showToast('You are offline. Please check your connection.', 'warning');
        } else {
            showToast('Network error. Please try again.', 'error');
        }
        
        throw error;
    }
}

// Offline detection
function initializeOfflineDetection() {
    const offlineIndicator = document.getElementById('offline-indicator');
    
    function updateOnlineStatus() {
        if (navigator.onLine) {
            if (offlineIndicator) {
                offlineIndicator.style.display = 'none';
            }
            // Sync offline data if any
            syncOfflineData();
        } else {
            if (offlineIndicator) {
                offlineIndicator.style.display = 'block';
            }
            showToast('You are now offline. Some features may be limited.', 'warning');
        }
    }
    
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Initial check
    updateOnlineStatus();
}

function syncOfflineData() {
    // Check for offline transactions in localStorage
    const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
    
    if (offlineTransactions.length > 0) {
        console.log(`Syncing ${offlineTransactions.length} offline transactions`);
        
        offlineTransactions.forEach(async (transaction, index) => {
            try {
                await apiRequest('/api/transactions', {
                    method: 'POST',
                    body: JSON.stringify(transaction)
                });
                
                // Remove synced transaction from offline storage
                offlineTransactions.splice(index, 1);
                localStorage.setItem('offline_transactions', JSON.stringify(offlineTransactions));
                
            } catch (error) {
                console.error('Failed to sync transaction:', error);
            }
        });
        
        if (offlineTransactions.length === 0) {
            showToast('Offline data synced successfully!', 'success');
        }
    }
}

// Update checking
function checkForUpdates() {
    // Simple version checking - in a real app this would check against a server
    const currentVersion = '1.0.0';
    const lastCheckedVersion = localStorage.getItem('app_version');
    
    if (lastCheckedVersion !== currentVersion) {
        localStorage.setItem('app_version', currentVersion);
        
        if (lastCheckedVersion) {
            showToast('FutureAssist has been updated to version ' + currentVersion, 'info');
        }
    }
}

// Help and tutorial functions
function showHelp() {
    const currentPage = window.location.pathname;
    let helpContent = '';
    
    switch (currentPage) {
        case '/':
            helpContent = `
                <h5>Dashboard Help</h5>
                <p>Your dashboard shows:</p>
                <ul>
                    <li><strong>Current Balance:</strong> Your total balance from all transactions</li>
                    <li><strong>Recent Transactions:</strong> Your last 5 transactions</li>
                    <li><strong>Quick Actions:</strong> Fast access to common features</li>
                    <li><strong>Alerts:</strong> Important financial notifications</li>
                </ul>
                <p><strong>Keyboard shortcuts:</strong></p>
                <ul>
                    <li>Alt + A: Add new transaction</li>
                    <li>Alt + T: Go to transactions</li>
                    <li>Alt + F: Go to forecast</li>
                </ul>
            `;
            break;
        case '/transactions':
            helpContent = `
                <h5>Transactions Help</h5>
                <p>Manage all your income and expenses:</p>
                <ul>
                    <li><strong>Add Transaction:</strong> Record income or expenses</li>
                    <li><strong>Auto-categorization:</strong> AI will suggest categories</li>
                    <li><strong>Search & Filter:</strong> Find specific transactions</li>
                    <li><strong>Bulk Actions:</strong> Manage multiple transactions at once</li>
                </ul>
            `;
            break;
        case '/forecast':
            helpContent = `
                <h5>Forecast Help</h5>
                <p>Understand your financial future:</p>
                <ul>
                    <li><strong>Balance Forecast:</strong> Predicted daily balances</li>
                    <li><strong>Cash Flow:</strong> Income vs expenses view</li>
                    <li><strong>Insights:</strong> AI-powered financial advice</li>
                    <li><strong>Confidence:</strong> How reliable predictions are</li>
                </ul>
            `;
            break;
        case '/settings':
            helpContent = `
                <h5>Settings Help</h5>
                <p>Customize your experience:</p>
                <ul>
                    <li><strong>Alerts:</strong> Set when to receive notifications</li>
                    <li><strong>Accessibility:</strong> Adjust for your needs</li>
                    <li><strong>Preferences:</strong> App behavior settings</li>
                </ul>
            `;
            break;
        default:
            helpContent = `
                <h5>FutureAssist Help</h5>
                <p>Welcome to FutureAssist! Here's how to get started:</p>
                <ol>
                    <li>Add your first transaction</li>
                    <li>Let AI categorize it automatically</li>
                    <li>View your forecast to plan ahead</li>
                    <li>Set up alerts for important notifications</li>
                </ol>
            `;
    }
    
    // Create and show help modal
    const helpModal = document.createElement('div');
    helpModal.className = 'modal fade';
    helpModal.innerHTML = `
        <div class="modal-dialog">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">
                        <i class="fas fa-question-circle text-primary me-2"></i>
                        Help
                    </h5>
                    <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    ${helpContent}
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(helpModal);
    const modal = new bootstrap.Modal(helpModal);
    
    helpModal.addEventListener('hidden.bs.modal', function() {
        document.body.removeChild(helpModal);
    });
    
    modal.show();
    
    // Speak help content if voice is enabled
    if (isVoiceEnabled()) {
        const textContent = helpModal.querySelector('.modal-body').textContent;
        speak(textContent);
    }
}

// Loading states
function showLoading(element, text = 'Loading...') {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    
    if (element) {
        // Create elements safely to prevent XSS
        const container = document.createElement('div');
        container.className = 'text-center p-4';
        
        const spinnerDiv = document.createElement('div');
        spinnerDiv.className = 'spinner-border text-primary mb-3';
        spinnerDiv.setAttribute('role', 'status');
        
        const hiddenSpan = document.createElement('span');
        hiddenSpan.className = 'visually-hidden';
        hiddenSpan.textContent = 'Loading...';
        spinnerDiv.appendChild(hiddenSpan);
        
        const textParagraph = document.createElement('p');
        textParagraph.className = 'text-muted';
        textParagraph.textContent = text; // Using textContent prevents XSS
        
        container.appendChild(spinnerDiv);
        container.appendChild(textParagraph);
        
        element.innerHTML = '';
        element.appendChild(container);
    }
}

function hideLoading(element) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    
    if (element) {
        element.classList.remove('loading');
    }
}

// Error handling
window.addEventListener('error', function(e) {
    console.error('JavaScript error:', e.error);
    
    if (getUserPreference('analytics', true)) {
        // Log error for debugging (in production, send to error tracking service)
        console.log('Error logged:', {
            message: e.message,
            filename: e.filename,
            lineno: e.lineno,
            colno: e.colno,
            timestamp: new Date().toISOString()
        });
    }
});

// Export functions for use in other scripts
window.FutureAssist = {
    showToast,
    speak,
    formatCurrency,
    formatDate,
    debounce,
    throttle,
    apiRequest,
    getUserPreference,
    saveUserPreference,
    showLoading,
    hideLoading,
    showHelp
};
