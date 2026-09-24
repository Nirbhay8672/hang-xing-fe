import { useCallback, useRef, useState } from 'react'

export type FormErrors = Record<string, string[]>

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Scrolls to (and focuses) the first field marked invalid, once React has rendered the errors. */
export function focusFirstInvalid(form: HTMLElement | null): void {
  setTimeout(() => {
    const first = form?.querySelector<HTMLElement>('[aria-invalid="true"]') ?? form?.querySelector<HTMLElement>('.hx-section-error')
    first?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    first?.focus({ preventScroll: true })
  }, 0)
}

/**
 * Form error state shared by the simple modal forms: errors are keyed by field name (the same
 * keys the API's 422 responses use), so client-side and server-side messages render through
 * the same `error={formErrors.field?.[0]}` props.
 */
export function useFormErrors() {
  const [formErrors, setFormErrors] = useState<FormErrors>({})
  const formRef = useRef<HTMLFormElement>(null)

  /** Drops the given fields' errors — call it as the user edits a field. */
  const clearError = useCallback((...keys: string[]) => {
    setFormErrors((prev) => {
      if (!keys.some((k) => k in prev)) return prev
      const next = { ...prev }
      for (const k of keys) delete next[k]
      return next
    })
  }, [])

  /** Shows the errors and moves the user to the first offending field. */
  const showErrors = useCallback((errors: FormErrors) => {
    setFormErrors(errors)
    focusFirstInvalid(formRef.current)
  }, [])

  return { formErrors, setFormErrors, clearError, showErrors, formRef }
}
