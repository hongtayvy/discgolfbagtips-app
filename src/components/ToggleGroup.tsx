export interface ToggleOption<T extends string> {
  value: T;
  label: string;
  icon?: string;
  hint?: string;
}

interface Props<T extends string> {
  label: string;
  options: ToggleOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Larger pill treatment used for the weather/conditions row. */
  variant?: 'default' | 'chunky';
}

/**
 * A segmented toggle — one tap to switch, no dropdown, no form submit.
 * Rendered as a radiogroup so arrow keys and screen readers behave.
 */
export function ToggleGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  variant = 'default',
}: Props<T>) {
  const move = (dir: 1 | -1) => {
    const i = options.findIndex((o) => o.value === value);
    onChange(options[(i + dir + options.length) % options.length].value);
  };

  return (
    <div className={`toggle-group toggle-group--${variant}`}>
      <span className="toggle-group__label">{label}</span>
      <div
        className="toggle-group__track"
        role="radiogroup"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            move(1);
          }
          if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            move(-1);
          }
        }}
      >
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              className={`toggle-group__option${selected ? ' is-selected' : ''}`}
              onClick={() => onChange(o.value)}
              title={o.hint}
            >
              {o.icon && (
                <span className="toggle-group__icon" aria-hidden="true">
                  {o.icon}
                </span>
              )}
              <span className="toggle-group__text">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
