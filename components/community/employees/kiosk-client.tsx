'use client';

import { useCallback, useEffect, useReducer, useRef } from 'react';
import { Delete } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface KioskClientProps {
  projectName: string;
  projectSlug: string;
}

type KioskScreen = 'idle' | 'pin_entry' | 'submitting' | 'result';

interface KioskState {
  screen: KioskScreen;
  pin: string;
  result: { action: 'in' | 'out'; firstName: string; punchedAt: string; durationMinutes?: number | null } | null;
  error: string | null;
}

type KioskAction =
  | { type: 'DIGIT'; digit: string }
  | { type: 'BACKSPACE' }
  | { type: 'CLEAR' }
  | { type: 'SUBMIT' }
  | { type: 'SUCCESS'; result: KioskState['result'] }
  | { type: 'ERROR'; message: string }
  | { type: 'RESET' };

function reducer(state: KioskState, action: KioskAction): KioskState {
  switch (action.type) {
    case 'DIGIT': {
      if (state.screen === 'submitting') return state;
      const newPin = state.pin + action.digit;
      if (newPin.length > 4) return state;
      const screen: KioskScreen = newPin.length > 0 ? 'pin_entry' : 'idle';
      return { ...state, pin: newPin, screen, error: null };
    }
    case 'BACKSPACE': {
      const newPin = state.pin.slice(0, -1);
      return { ...state, pin: newPin, screen: newPin.length > 0 ? 'pin_entry' : 'idle', error: null };
    }
    case 'CLEAR':
      return { ...state, pin: '', screen: 'idle', error: null };
    case 'SUBMIT':
      return { ...state, screen: 'submitting' };
    case 'SUCCESS':
      return { screen: 'result', pin: '', result: action.result, error: null };
    case 'ERROR':
      return { screen: 'pin_entry', pin: '', result: null, error: action.message };
    case 'RESET':
      return { screen: 'idle', pin: '', result: null, error: null };
    default:
      return state;
  }
}

const initialState: KioskState = { screen: 'idle', pin: '', result: null, error: null };

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function KioskClient({ projectName, projectSlug }: KioskClientProps) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const submitPin = useCallback(async (pin: string) => {
    try {
      const res = await fetch(`/api/kiosk/${projectSlug}/punch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json() as {
        action?: 'in' | 'out';
        first_name?: string;
        punched_at?: string;
        duration_minutes?: number | null;
        error?: string;
      };
      if (!res.ok) {
        dispatch({ type: 'ERROR', message: data.error ?? 'PIN not recognized' });
        return;
      }
      dispatch({
        type: 'SUCCESS',
        result: {
          action: data.action!,
          firstName: data.first_name ?? '',
          punchedAt: data.punched_at!,
          durationMinutes: data.duration_minutes ?? null,
        },
      });
    } catch {
      dispatch({ type: 'ERROR', message: 'Connection error. Please try again.' });
    }
  }, [projectSlug]);

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (state.pin.length === 4 && state.screen === 'pin_entry') {
      dispatch({ type: 'SUBMIT' });
      void submitPin(state.pin);
    }
  }, [state.pin, state.screen, submitPin]);

  // Auto-reset after result display
  useEffect(() => {
    if (state.screen === 'result') {
      resetTimerRef.current = setTimeout(() => {
        dispatch({ type: 'RESET' });
      }, 4000);
    }
    return () => {
      if (resetTimerRef.current) clearTimeout(resetTimerRef.current);
    };
  }, [state.screen]);

  // Keyboard support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key >= '0' && e.key <= '9') {
        dispatch({ type: 'DIGIT', digit: e.key });
      } else if (e.key === 'Backspace') {
        dispatch({ type: 'BACKSPACE' });
      } else if (e.key === 'Escape') {
        dispatch({ type: 'RESET' });
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Employee Kiosk
          </div>
          <div className="mt-1 text-xl font-semibold">{projectName}</div>
        </div>

        {/* Result screen */}
        {state.screen === 'result' && state.result ? (
          <div className={`rounded-2xl border p-8 text-center ${state.result.action === 'in' ? 'border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30' : 'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30'}`}>
            <div className="text-4xl font-bold">
              {state.result.action === 'in' ? '👋' : '✅'}
            </div>
            <div className="mt-3 text-lg font-semibold">
              {state.result.action === 'in'
                ? `Welcome, ${state.result.firstName}!`
                : `Goodbye, ${state.result.firstName}!`}
            </div>
            <div className="mt-1 text-muted-foreground">
              {state.result.action === 'in'
                ? `Clocked IN at ${formatTime(state.result.punchedAt)}`
                : `Clocked OUT at ${formatTime(state.result.punchedAt)}${state.result.durationMinutes != null ? ` — ${formatDuration(state.result.durationMinutes)} logged` : ''}`}
            </div>
          </div>
        ) : (
          <>
            {/* PIN dots */}
            <div className="mb-6 flex justify-center gap-4">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`h-4 w-4 rounded-full border-2 transition-colors ${i < state.pin.length ? 'border-foreground bg-foreground' : 'border-muted-foreground bg-transparent'}`}
                />
              ))}
            </div>

            {/* Prompt / error */}
            <div className="mb-6 text-center">
              {state.error ? (
                <p className="text-sm font-medium text-destructive">{state.error}</p>
              ) : state.screen === 'submitting' ? (
                <p className="text-sm text-muted-foreground">Checking…</p>
              ) : (
                <p className="text-sm text-muted-foreground">Enter your 4-digit PIN to clock in or out</p>
              )}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-3">
              {DIGITS.map((digit, i) => {
                if (digit === '') return <div key={i} />;
                if (digit === 'del') {
                  return (
                    <Button
                      key="del"
                      variant="outline"
                      size="lg"
                      className="h-16 text-lg"
                      onClick={() => dispatch({ type: 'BACKSPACE' })}
                      disabled={state.screen === 'submitting'}
                    >
                      <Delete className="h-5 w-5" />
                    </Button>
                  );
                }
                return (
                  <Button
                    key={digit}
                    variant="outline"
                    size="lg"
                    className="h-16 text-2xl font-medium"
                    onClick={() => dispatch({ type: 'DIGIT', digit })}
                    disabled={state.screen === 'submitting'}
                  >
                    {digit}
                  </Button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
