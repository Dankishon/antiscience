'use client';

import { cn } from '../lib/cn';

export type RadioGroupOption = {
  description?: string;
  label: string;
  value: string;
};

type RadioGroupProps = {
  label: string;
  name: string;
  onChange: (nextValue: string) => void;
  options: readonly RadioGroupOption[];
  value?: string;
};

export function RadioGroup({ label, name, onChange, options, value }: RadioGroupProps) {
  return (
    <fieldset className="radioGroup">
      <legend className="radioLegend">{label}</legend>
      <div className="radioOptions">
        {options.map((option) => {
          const id = `${name}-${option.value}`;
          const checked = value === option.value;

          return (
            <label className={cn('radioOption', checked && 'radioOption--selected')} htmlFor={id} key={id}>
              <input
                checked={checked}
                className="radioInput"
                id={id}
                name={name}
                onChange={() => onChange(option.value)}
                type="radio"
                value={option.value}
              />
              <span className="radioCopy">
                <strong className="radioLabel">{option.label}</strong>
                {option.description ? <span className="radioDescription">{option.description}</span> : null}
              </span>
              <span aria-hidden="true" className="radioIndicator" />
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
