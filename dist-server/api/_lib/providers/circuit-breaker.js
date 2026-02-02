/**
 * Simple in-memory circuit breaker for AI retry logic
 *
 * States:
 * - CLOSED: Normal operation, requests proceed
 * - OPEN: Too many consecutive failures, skip retries
 * - HALF_OPEN: Testing if service recovered, allow one request
 *
 * Pattern: CLOSED → OPEN (after N failures) → HALF_OPEN (after timeout) → CLOSED (on success) or OPEN (on failure)
 */
const DEFAULT_CONFIG = {
    failureThreshold: 5,
    resetTimeout: 60000 // 1 minute
};
class CircuitBreaker {
    config;
    state;
    constructor(config = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.state = {
            state: 'CLOSED',
            consecutiveFailures: 0,
            lastFailureTime: null,
            lastStateChange: Date.now()
        };
        console.log('[Circuit Breaker] Initialized with config:', this.config);
    }
    /**
     * Check if the circuit is open (should skip retries)
     */
    isOpen() {
        // Check if we should transition from OPEN → HALF_OPEN
        if (this.state.state === 'OPEN') {
            const now = Date.now();
            const timeSinceLastFailure = this.state.lastFailureTime ? now - this.state.lastFailureTime : Infinity;
            if (timeSinceLastFailure >= this.config.resetTimeout) {
                console.log('[Circuit Breaker] Transitioning from OPEN → HALF_OPEN (timeout reached)');
                this.state.state = 'HALF_OPEN';
                this.state.lastStateChange = now;
                return false;
            }
            return true;
        }
        return false;
    }
    /**
     * Record a successful operation
     */
    recordSuccess() {
        const previousState = this.state.state;
        if (previousState !== 'CLOSED') {
            console.log(`[Circuit Breaker] Success! Transitioning from ${previousState} → CLOSED`);
        }
        this.state.state = 'CLOSED';
        this.state.consecutiveFailures = 0;
        this.state.lastFailureTime = null;
        this.state.lastStateChange = Date.now();
    }
    /**
     * Record a failed operation
     */
    recordFailure() {
        const now = Date.now();
        this.state.consecutiveFailures++;
        this.state.lastFailureTime = now;
        const previousState = this.state.state;
        // If in HALF_OPEN, immediately go back to OPEN on failure
        if (previousState === 'HALF_OPEN') {
            console.log('[Circuit Breaker] Failure in HALF_OPEN → OPEN');
            this.state.state = 'OPEN';
            this.state.lastStateChange = now;
            return;
        }
        // If in CLOSED and reached threshold, transition to OPEN
        if (previousState === 'CLOSED' && this.state.consecutiveFailures >= this.config.failureThreshold) {
            console.log(`[Circuit Breaker] Failure threshold reached (${this.state.consecutiveFailures}/${this.config.failureThreshold}) → OPEN`);
            this.state.state = 'OPEN';
            this.state.lastStateChange = now;
            return;
        }
        if (previousState === 'CLOSED') {
            console.log(`[Circuit Breaker] Failure recorded (${this.state.consecutiveFailures}/${this.config.failureThreshold})`);
        }
    }
    /**
     * Get current circuit state (for monitoring)
     */
    getState() {
        return { ...this.state };
    }
    /**
     * Reset the circuit breaker (for testing/admin)
     */
    reset() {
        console.log('[Circuit Breaker] Manual reset');
        this.state = {
            state: 'CLOSED',
            consecutiveFailures: 0,
            lastFailureTime: null,
            lastStateChange: Date.now()
        };
    }
    /**
     * Update configuration (for testing)
     */
    updateConfig(config) {
        this.config = { ...this.config, ...config };
    }
}
// Singleton instance
let circuitBreakerInstance = null;
/**
 * Get or create the global circuit breaker instance
 */
export function getCircuitBreaker(config) {
    if (!circuitBreakerInstance) {
        circuitBreakerInstance = new CircuitBreaker(config);
    }
    else if (config) {
        // Update config if provided (mainly for tests)
        circuitBreakerInstance.updateConfig(config);
    }
    return circuitBreakerInstance;
}
/**
 * Get current circuit state for monitoring
 */
export function getCircuitState() {
    return getCircuitBreaker().getState();
}
/**
 * Reset circuit breaker (for testing/admin)
 */
export function resetCircuitBreaker() {
    getCircuitBreaker().reset();
}
//# sourceMappingURL=circuit-breaker.js.map