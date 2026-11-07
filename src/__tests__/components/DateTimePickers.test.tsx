import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import DatePickerField from '@/components/DatePickerField';
import TimePickerField from '@/components/TimePickerField';

describe('date and time pickers', () => {
  it('opens a calendar and selects a day', () => {
    const onChange = vi.fn();
    render(
      <div>
        <label htmlFor="pick-date">Event date</label>
        <DatePickerField id="pick-date" value="" onChange={onChange} min="2026-10-01" />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /pick a date/i }));
    fireEvent.click(screen.getByRole('gridcell', { name: '15' }));
    expect(onChange).toHaveBeenCalledWith('2026-10-15');
  });

  it('opens a time list and selects a slot', () => {
    const onChange = vi.fn();
    render(
      <div>
        <label htmlFor="pick-time">Event time</label>
        <TimePickerField id="pick-time" value="15:00" onChange={onChange} />
      </div>,
    );
    fireEvent.click(screen.getByRole('button', { name: /15:00/i }));
    fireEvent.click(screen.getByRole('option', { name: /19:00/i }));
    expect(onChange).toHaveBeenCalledWith('19:00');
  });

  it('still accepts a typed ISO value on the labelled field', () => {
    const onChange = vi.fn();
    render(
      <div>
        <label htmlFor="pick-date">Event date</label>
        <DatePickerField id="pick-date" value="" onChange={onChange} />
      </div>,
    );
    fireEvent.change(screen.getByLabelText(/event date/i), { target: { value: '2026-11-02' } });
    expect(onChange).toHaveBeenCalledWith('2026-11-02');
  });
});
