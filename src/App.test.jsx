import { beforeEach, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

test('renders the authentication experience and API settings', async () => {
  render(<App />);

  expect(screen.getByRole('heading', { name: 'Sign in to TaskFlow' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'API Configuration' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
});

test('shows the task dashboard when a valid session exists', async () => {
  localStorage.setItem('taskflow_token', 'token');
  localStorage.setItem('taskflow_user', 'user@example.com');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [],
  }));

  render(<App />);

  expect(await screen.findByText('Signed in as')).toBeTruthy();
  expect(screen.getByText('user@example.com')).toBeTruthy();
  expect(screen.getByPlaceholderText('What needs to be done today?...')).toBeTruthy();
});

test('allows the user to switch authentication modes', async () => {
  const user = userEvent.setup();
  render(<App />);

  await user.click(screen.getByRole('button', { name: 'Sign up' }));

  expect(screen.getByRole('button', { name: 'Create account' })).toBeTruthy();
  expect(screen.getByText('Build a calmer, more productive routine from day one.')).toBeTruthy();
});
