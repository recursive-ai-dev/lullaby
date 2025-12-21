/**
 * Simple Error Monitor for Lullaby Web
 */
const ErrorMonitor = {
    logs: [],
    init() {
        window.onerror = (message, source, lineno, colno, error) => {
            this.capture({
                type: 'error',
                message,
                source,
                lineno,
                colno,
                error: error?.stack,
                timestamp: new Date().toISOString()
            });
        };

        window.onunhandledrejection = (event) => {
            this.capture({
                type: 'unhandledrejection',
                reason: event.reason,
                timestamp: new Date().toISOString()
            });
        };

        console.info('Error monitoring initialized.');
    },

    capture(errorData) {
        this.logs.push(errorData);
        // In a real app, this would be sent to a telemetry endpoint
        console.warn('[Telemetry]', errorData);

        // Store in localStorage for debug persistence
        try {
            const stored = JSON.parse(localStorage.getItem('lullaby_errors') || '[]');
            stored.push(errorData);
            localStorage.setItem('lullaby_errors', JSON.stringify(stored.slice(-50)));
        } catch (e) {
            // Ignore storage errors
        }
    }
};

export default ErrorMonitor;
