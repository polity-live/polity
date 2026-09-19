import { useState } from 'react';
import { expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { page } from 'vitest/browser';
import { ValidatedInputField } from '../ValidatedInputField';
import '@/styles.css';

function Form() {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState(false);
  return (
    <div style={{ width: 400 }}>
      <ValidatedInputField
        label="Group name"
        value={name}
        onChange={setName}
        hint="At least three characters"
      />
      <button type="button" aria-pressed={selected} onClick={() => setSelected(true)}>
        Private
      </button>
    </div>
  );
}

it('keeps the next control in place when a focused validation hint disappears', async () => {
  const view = await render(<Form />);
  try {
    await page.getByRole('combobox', { name: 'Group name' }).fill('Updated group');
    const button = page.getByRole('button', { name: 'Private' });
    const before = button.element().getBoundingClientRect().top;
    await button.click();
    await expect.element(button).toHaveAttribute('aria-pressed', 'true');
    expect(button.element().getBoundingClientRect().top).toBe(before);
  } finally {
    await view.unmount();
  }
});
