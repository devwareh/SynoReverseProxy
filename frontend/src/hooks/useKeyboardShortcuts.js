import { useEffect } from 'react';

/**
 * Custom hook to handle keyboard shortcuts
 * @param {Object} shortcuts - Object mapping key combinations to handlers
 * @param {Array} deps - Dependencies array
 */
function useKeyboardShortcuts(shortcuts, deps = []) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Check each shortcut
      Object.entries(shortcuts).forEach(([key, handler]) => {
        const parts = key.split('+').map(s => s.trim().toLowerCase());
        const ctrl = parts.includes('ctrl') || parts.includes('cmd');
        const shift = parts.includes('shift');
        const alt = parts.includes('alt');
        const meta = parts.includes('meta');
        const keyPart = parts.find(p => !['ctrl', 'cmd', 'shift', 'alt', 'meta'].includes(p));

        // Check modifiers
        const ctrlPressed = e.ctrlKey || e.metaKey; // Cmd on Mac
        const shiftPressed = e.shiftKey;
        const altPressed = e.altKey;
        const metaPressed = e.metaKey;

        // Check if modifiers match
        const modifiersMatch = 
          (ctrl ? ctrlPressed : !ctrlPressed) &&
          (shift ? shiftPressed : !shiftPressed) &&
          (alt ? altPressed : !altPressed) &&
          (meta ? metaPressed : !metaPressed);

        // Check if key matches (case insensitive)
        const keyMatch = keyPart && e.key.toLowerCase() === keyPart.toLowerCase();

        if (modifiersMatch && (!keyPart || keyMatch)) {
          e.preventDefault();
          handler(e);
        }
      });
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts, ...deps]);
}

export default useKeyboardShortcuts;

