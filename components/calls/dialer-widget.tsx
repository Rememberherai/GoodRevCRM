'use client';

import { useState } from 'react';
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Pause,
  Play,
  Hash,
  X,
  Minimize2,
  Maximize2,
  Circle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTelnyx } from '@/providers/telnyx-provider';
import { useCallStore } from '@/stores/call';
import { toast } from 'sonner';

const DIAL_PAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function DialerWidget() {
  const {
    isConnected,
    callState,
    isMuted,
    isOnHold,
    makeCall,
    hangUp,
    toggleMute,
    toggleHold,
    sendDTMF,
    hasConnection,
  } = useTelnyx();

  const {
    showDialer,
    toggleDialer,
    setShowDialer,
    callTimer,
    currentCallRecord,
  } = useCallStore();

  const [dialNumber, setDialNumber] = useState('');
  const [showKeypad, setShowKeypad] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!hasConnection) return null;

  const isInCall = callState !== 'idle';

  const handleDial = async () => {
    if (!dialNumber.trim()) return;
    try {
      await makeCall(dialNumber.trim());
      setDialNumber('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to start call');
    }
  };

  const handleKeypadPress = (digit: string) => {
    if (isInCall) {
      sendDTMF(digit);
    } else {
      setDialNumber((prev) => prev + digit);
    }
  };

  // Floating button when dialer is closed
  if (!showDialer && !isInCall) {
    return (
      <button
        onClick={toggleDialer}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
        title="Open dialer"
      >
        <Phone className="h-6 w-6" />
        {isConnected && (
          <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
        )}
      </button>
    );
  }

  // Minimized active call indicator
  if (isInCall && isMinimized) {
    return (
      <div
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-full bg-green-600 text-white px-4 py-2.5 shadow-lg cursor-pointer hover:bg-green-700 transition-colors"
        onClick={() => setIsMinimized(false)}
      >
        <Circle className="h-3 w-3 animate-pulse fill-current" />
        <span className="text-sm font-medium">{formatTime(callTimer)}</span>
        <Maximize2 className="h-4 w-4" />
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-72 rounded-lg border bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4" />
          <span className="text-sm font-medium">
            {isInCall ? 'Active Call' : 'Phone'}
          </span>
          {isConnected && !isInCall && (
            <span className="h-2 w-2 rounded-full bg-green-500" />
          )}
        </div>
        <div className="flex items-center gap-1">
          {isInCall && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setIsMinimized(true)}
            >
              <Minimize2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isInCall && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setShowDialer(false)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Active Call View */}
      {isInCall ? (
        <div className="p-4 space-y-4">
          {/* Call info */}
          <div className="text-center space-y-1">
            <p className="text-sm text-muted-foreground">
              {callState === 'connecting' ? 'Connecting...' :
               callState === 'ringing' ? 'Ringing...' :
               callState === 'active' ? 'Connected' : 'Ending...'}
            </p>
            <p className="font-medium">
              {currentCallRecord?.to_number ?? 'Unknown'}
            </p>
            {callState === 'active' && (
              <p className="text-2xl font-mono font-bold text-green-600">
                {formatTime(callTimer)}
              </p>
            )}
          </div>

          {/* Call controls */}
          <div className="flex items-center justify-center gap-3">
            <Button
              variant={isMuted ? 'destructive' : 'outline'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleMute}
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </Button>
            <Button
              variant="destructive"
              size="icon"
              className="h-14 w-14 rounded-full"
              onClick={hangUp}
              title="End call"
            >
              <PhoneOff className="h-6 w-6" />
            </Button>
            <Button
              variant={isOnHold ? 'secondary' : 'outline'}
              size="icon"
              className="h-12 w-12 rounded-full"
              onClick={toggleHold}
              title={isOnHold ? 'Resume' : 'Hold'}
            >
              {isOnHold ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </Button>
          </div>

          {/* Keypad toggle */}
          <div className="flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowKeypad(!showKeypad)}
            >
              <Hash className="h-4 w-4 mr-1" />
              Keypad
            </Button>
          </div>

          {/* In-call keypad */}
          {showKeypad && (
            <div className="grid grid-cols-3 gap-1">
              {DIAL_PAD.flat().map((digit) => (
                <Button
                  key={digit}
                  variant="ghost"
                  className="h-10 text-lg font-medium"
                  onClick={() => handleKeypadPress(digit)}
                >
                  {digit}
                </Button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Idle dialer view */
        <div className="p-4 space-y-3">
          {/* Number input */}
          <div className="flex gap-2">
            <Input
              value={dialNumber}
              onChange={(e) => setDialNumber(e.target.value)}
              placeholder="Enter phone number..."
              className="text-center font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleDial()}
            />
          </div>

          {/* Dial pad */}
          <div className="grid grid-cols-3 gap-1">
            {DIAL_PAD.flat().map((digit) => (
              <Button
                key={digit}
                variant="ghost"
                className="h-10 text-lg font-medium"
                onClick={() => handleKeypadPress(digit)}
              >
                {digit}
              </Button>
            ))}
          </div>

          {/* Dial button */}
          <Button
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleDial}
            disabled={!dialNumber.trim() || !isConnected}
          >
            <Phone className="h-4 w-4 mr-2" />
            Call
          </Button>

          {!isConnected && (
            <p className="text-xs text-center text-muted-foreground">
              Connecting to phone service...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
