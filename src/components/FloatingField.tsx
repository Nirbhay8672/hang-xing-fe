import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

/* Shared floating-label form fields used by every form in the app (Login, and the
   Users/Companies/Orders/Roles/Profile create-edit forms). At rest, the label sits
   centered over the control like a placeholder; on focus, or once the field has a real
   value, it hops up to sit on the control's top border in the accent color. Position
   ("floated") and color ("accented") are tracked separately: a <select>/date field is
   always kept floated so the label never overlaps the browser's own placeholder text
   (e.g. "— Select —" or "mm/dd/yyyy"), but only turns accent-colored once it's actually
   focused or has a real value chosen — otherwise an untouched dropdown would misleadingly
   look "filled". This is all driven from React state, not the CSS :placeholder-shown
   trick, so it also behaves correctly with browser autofill. */

const ALWAYS_FLOAT_TYPES = new Set(['date', 'time', 'month', 'week', 'datetime-local'])

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

type Variant = 'lg' | 'default' | 'bare'

function variantClass(variant: Variant): string {
  if (variant === 'bare') return ''
  return variant === 'lg' ? 'form-control form-control-lg' : 'form-control'
}

interface FloatingInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'placeholder' | 'size'> {
  label: string
  error?: string
  id?: string
  variant?: Variant
  wrapperClassName?: string
  endAdornment?: ReactNode
}

export function FloatingInput({
  label,
  error,
  id,
  variant = 'lg',
  wrapperClassName,
  endAdornment,
  className,
  value,
  type,
  onFocus,
  onBlur,
  required,
  ...rest
}: FloatingInputProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const errorId = `${inputId}-error`
  const [focused, setFocused] = useState(false)

  const hasValue = value !== undefined && value !== null && String(value).length > 0
  const forceFloat = typeof type === 'string' && ALWAYS_FLOAT_TYPES.has(type)
  const floated = focused || hasValue || forceFloat
  const accented = focused || hasValue

  return (
    <div
      className={cx(
        'hx-floating',
        floated && 'hx-floating--floated',
        accented && 'hx-floating--accent',
        error && 'hx-floating--invalid',
        Boolean(endAdornment) && 'hx-floating--with-adornment',
        wrapperClassName,
      )}
    >
      <input
        id={inputId}
        type={type}
        className={cx(variantClass(variant), className)}
        value={value}
        required={required}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
      />
      <label htmlFor={inputId}>{label}</label>
      {endAdornment}
      {error && (
        <small id={errorId} className="hx-field-error">
          {error}
        </small>
      )}
    </div>
  )
}

interface FloatingSelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'size'> {
  label: string
  error?: string
  id?: string
  variant?: Variant
  wrapperClassName?: string
  children: ReactNode
}

export function FloatingSelect({
  label,
  error,
  id,
  variant = 'lg',
  wrapperClassName,
  className,
  value,
  onFocus,
  onBlur,
  required,
  children,
  ...rest
}: FloatingSelectProps) {
  const autoId = useId()
  const selectId = id ?? autoId
  const errorId = `${selectId}-error`
  const [focused, setFocused] = useState(false)

  const hasValue = value !== undefined && value !== null && String(value).length > 0
  const accented = focused || hasValue

  return (
    <div
      className={cx(
        'hx-floating',
        'hx-floating--floated',
        accented && 'hx-floating--accent',
        error && 'hx-floating--invalid',
        wrapperClassName,
      )}
    >
      <select
        id={selectId}
        className={cx(variantClass(variant), className)}
        value={value}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
      >
        {children}
      </select>
      <label htmlFor={selectId}>{label}</label>
      {error && (
        <small id={errorId} className="hx-field-error">
          {error}
        </small>
      )}
    </div>
  )
}

interface FloatingTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'placeholder'> {
  label: string
  error?: string
  id?: string
  wrapperClassName?: string
}

export function FloatingTextarea({
  label,
  error,
  id,
  wrapperClassName,
  className,
  value,
  onFocus,
  onBlur,
  required,
  ...rest
}: FloatingTextareaProps) {
  const autoId = useId()
  const textareaId = id ?? autoId
  const errorId = `${textareaId}-error`
  const [focused, setFocused] = useState(false)

  const hasValue = value !== undefined && value !== null && String(value).length > 0
  const active = focused || hasValue

  return (
    <div
      className={cx(
        'hx-floating',
        'hx-floating--textarea',
        active && 'hx-floating--floated',
        active && 'hx-floating--accent',
        error && 'hx-floating--invalid',
        wrapperClassName,
      )}
    >
      <textarea
        id={textareaId}
        className={cx('form-control', className)}
        value={value}
        required={required}
        placeholder=" "
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={(e) => {
          setFocused(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onBlur?.(e)
        }}
        {...rest}
      />
      <label htmlFor={textareaId}>{label}</label>
      {error && (
        <small id={errorId} className="hx-field-error">
          {error}
        </small>
      )}
    </div>
  )
}
