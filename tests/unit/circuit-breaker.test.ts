/**
 * Tests for circuit breaker
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { getCircuitBreaker, resetCircuitBreaker, getCircuitState } from '../../api/_lib/providers/circuit-breaker.js'

describe('CircuitBreaker', () => {
  beforeEach(() => {
    resetCircuitBreaker()
  })

  it('should start in CLOSED state', () => {
    const breaker = getCircuitBreaker()
    expect(breaker.isOpen()).toBe(false)
    expect(getCircuitState().state).toBe('CLOSED')
    expect(getCircuitState().consecutiveFailures).toBe(0)
  })

  it('should remain CLOSED under threshold', () => {
    const breaker = getCircuitBreaker({ failureThreshold: 5 })

    // Record 4 failures (under threshold)
    for (let i = 0; i < 4; i++) {
      breaker.recordFailure()
    }

    expect(breaker.isOpen()).toBe(false)
    expect(getCircuitState().state).toBe('CLOSED')
    expect(getCircuitState().consecutiveFailures).toBe(4)
  })

  it('should open after reaching failure threshold', () => {
    const breaker = getCircuitBreaker({ failureThreshold: 5 })

    // Record 5 failures (reach threshold)
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure()
    }

    expect(breaker.isOpen()).toBe(true)
    expect(getCircuitState().state).toBe('OPEN')
    expect(getCircuitState().consecutiveFailures).toBe(5)
  })

  it('should transition from OPEN to HALF_OPEN after reset timeout', async () => {
    const breaker = getCircuitBreaker({ failureThreshold: 5, resetTimeout: 100 })

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure()
    }
    expect(breaker.isOpen()).toBe(true)

    // Wait for reset timeout
    await new Promise(resolve => setTimeout(resolve, 150))

    // Check should transition to HALF_OPEN
    expect(breaker.isOpen()).toBe(false)
    expect(getCircuitState().state).toBe('HALF_OPEN')
  })

  it('should close on success in HALF_OPEN', async () => {
    const breaker = getCircuitBreaker({ failureThreshold: 5, resetTimeout: 100 })

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure()
    }

    // Wait for transition to HALF_OPEN
    await new Promise(resolve => setTimeout(resolve, 150))
    expect(breaker.isOpen()).toBe(false)
    expect(getCircuitState().state).toBe('HALF_OPEN')

    // Success in HALF_OPEN should close circuit
    breaker.recordSuccess()
    expect(breaker.isOpen()).toBe(false)
    expect(getCircuitState().state).toBe('CLOSED')
    expect(getCircuitState().consecutiveFailures).toBe(0)
  })

  it('should reopen on failure in HALF_OPEN', async () => {
    const breaker = getCircuitBreaker({ failureThreshold: 5, resetTimeout: 100 })

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure()
    }

    // Wait for transition to HALF_OPEN
    await new Promise(resolve => setTimeout(resolve, 150))
    // Call isOpen() to trigger state transition check
    breaker.isOpen()
    expect(getCircuitState().state).toBe('HALF_OPEN')

    // Failure in HALF_OPEN should reopen circuit
    breaker.recordFailure()
    expect(breaker.isOpen()).toBe(true)
    expect(getCircuitState().state).toBe('OPEN')
  })

  it('should reset consecutive failures on success', () => {
    const breaker = getCircuitBreaker({ failureThreshold: 5 })

    // Record some failures
    breaker.recordFailure()
    breaker.recordFailure()
    expect(getCircuitState().consecutiveFailures).toBe(2)

    // Success should reset counter
    breaker.recordSuccess()
    expect(getCircuitState().consecutiveFailures).toBe(0)
    expect(getCircuitState().state).toBe('CLOSED')
  })

  it('should provide getCircuitState for monitoring', () => {
    const breaker = getCircuitBreaker()

    breaker.recordFailure()
    breaker.recordFailure()

    const state = getCircuitState()
    expect(state.state).toBe('CLOSED')
    expect(state.consecutiveFailures).toBe(2)
    expect(state.lastFailureTime).toBeGreaterThan(0)
  })

  it('should reset circuit manually', () => {
    const breaker = getCircuitBreaker()

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      breaker.recordFailure()
    }
    expect(breaker.isOpen()).toBe(true)

    // Manual reset
    resetCircuitBreaker()
    expect(breaker.isOpen()).toBe(false)
    expect(getCircuitState().state).toBe('CLOSED')
    expect(getCircuitState().consecutiveFailures).toBe(0)
  })

  it('should use singleton instance', () => {
    const breaker1 = getCircuitBreaker()
    const breaker2 = getCircuitBreaker()

    breaker1.recordFailure()
    expect(getCircuitState().consecutiveFailures).toBe(1)

    // Both references should share the same state
    breaker2.recordFailure()
    expect(getCircuitState().consecutiveFailures).toBe(2)
  })
})
