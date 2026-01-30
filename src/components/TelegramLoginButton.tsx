import { useEffect, useRef } from 'react'

interface TelegramLoginButtonProps {
  botUsername: string
  authCallbackUrl: string
  buttonSize?: 'small' | 'medium' | 'large'
  requestWriteAccess?: boolean
  onAuthError?: (error: string) => void
}

/**
 * Telegram Login Widget
 *
 * Dynamically loads Telegram's official login widget script
 * and handles authentication redirect.
 *
 * @see https://core.telegram.org/widgets/login
 */
export default function TelegramLoginButton({
  botUsername,
  authCallbackUrl,
  buttonSize = 'large',
  requestWriteAccess = true,
  onAuthError,
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Clean up previous widget if any
    if (containerRef.current) {
      containerRef.current.innerHTML = ''
    }

    // Create script element
    const script = document.createElement('script')
    script.src = 'https://telegram.org/js/telegram-widget.js?22'
    script.async = true
    script.setAttribute('data-telegram-login', botUsername)
    script.setAttribute('data-size', buttonSize)
    script.setAttribute('data-auth-url', authCallbackUrl)

    if (requestWriteAccess) {
      script.setAttribute('data-request-access', 'write')
    }

    // Handle script load errors
    script.onerror = () => {
      if (onAuthError) {
        onAuthError('Failed to load Telegram widget')
      }
    }

    // Append script to container
    if (containerRef.current) {
      containerRef.current.appendChild(script)
    }

    // Cleanup function
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = ''
      }
    }
  }, [botUsername, authCallbackUrl, buttonSize, requestWriteAccess, onAuthError])

  return (
    <div
      ref={containerRef}
      className="flex justify-center"
    />
  )
}
