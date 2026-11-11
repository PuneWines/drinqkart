import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import ConfirmDialog from '../components/common/ConfirmDialog';

const DialogContext = createContext(null);

// Global bridge for non-hook usage (e.g. standard async functions, service handlers)
let globalDialogHandler = null;

export const showConfirm = (options) => {
  if (globalDialogHandler?.confirm) {
    return globalDialogHandler.confirm(options);
  }
  // Fallback if dialog context not mounted yet
  return Promise.resolve(window.confirm(typeof options === 'string' ? options : options.message));
};

export const showPrompt = (options) => {
  if (globalDialogHandler?.prompt) {
    return globalDialogHandler.prompt(options);
  }
  return Promise.resolve(window.prompt(typeof options === 'string' ? options : options.message));
};

export const showAlert = (message, explicitType) => {
  const text = String(message || '').trim();
  if (!text) return;

  if (explicitType === 'error') {
    toast.error(text);
    return;
  }
  if (explicitType === 'success') {
    toast.success(text);
    return;
  }
  if (explicitType === 'warning') {
    toast(text, { icon: '⚠️' });
    return;
  }

  const lower = text.toLowerCase();
  const isError =
    lower.includes('error') ||
    lower.includes('failed') ||
    lower.includes('failure') ||
    lower.includes('cannot') ||
    lower.includes('not supported') ||
    lower.includes('invalid') ||
    lower.includes('restricted') ||
    lower.includes('denied') ||
    lower.includes('please select') ||
    lower.includes('please fill') ||
    lower.includes('please provide') ||
    lower.includes('please enter') ||
    lower.includes('please draw') ||
    lower.includes('is required') ||
    lower.includes('already exists') ||
    lower.includes('no tasks') ||
    lower.includes('no items') ||
    lower.includes('no data');

  const isWarning =
    lower.includes('warning') ||
    lower.includes('⚠️') ||
    lower.includes('caution') ||
    lower.includes('attention') ||
    lower.includes('hold');

  const isSuccess =
    lower.includes('success') ||
    lower.includes('successfully') ||
    lower.includes('created') ||
    lower.includes('saved') ||
    lower.includes('updated') ||
    lower.includes('deleted') ||
    lower.includes('restored') ||
    lower.includes('unlocked') ||
    lower.includes('completed') ||
    lower.includes('sent') ||
    lower.includes('🎉') ||
    lower.includes('✓');

  if (isError) {
    toast.error(text);
  } else if (isSuccess) {
    toast.success(text);
  } else if (isWarning) {
    toast(text, { icon: '⚠️' });
  } else {
    toast(text, { icon: 'ℹ️' });
  }
};

// Immediate safety-net interceptor to neutralize native alert before anything mounts
if (typeof window !== 'undefined') {
  window.alert = (msg) => {
    showAlert(msg);
  };
}

export function DialogProvider({ children }) {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    type: 'warning',
    isPrompt: false,
    promptValue: '',
    promptPlaceholder: '',
  });

  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      setDialogState({
        isOpen: true,
        title: opts.title || (opts.type === 'danger' ? 'Are you sure?' : 'Confirmation'),
        message: opts.message || '',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        type: opts.type || 'warning',
        isPrompt: false,
        promptValue: '',
        promptPlaceholder: '',
      });
    });
  }, []);

  const prompt = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      const opts = typeof options === 'string' ? { message: options } : (options || {});
      setDialogState({
        isOpen: true,
        title: opts.title || 'Required Input',
        message: opts.message || '',
        confirmText: opts.confirmText || 'Submit',
        cancelText: opts.cancelText || 'Cancel',
        type: opts.type || 'prompt',
        isPrompt: true,
        promptValue: opts.defaultValue || '',
        promptPlaceholder: opts.placeholder || 'Enter value...',
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    if (resolverRef.current) {
      if (dialogState.isPrompt) {
        resolverRef.current(dialogState.promptValue);
      } else {
        resolverRef.current(true);
      }
      resolverRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, [dialogState.isPrompt, dialogState.promptValue]);

  const handleCancel = useCallback(() => {
    if (resolverRef.current) {
      if (dialogState.isPrompt) {
        resolverRef.current(null);
      } else {
        resolverRef.current(false);
      }
      resolverRef.current = null;
    }
    setDialogState((prev) => ({ ...prev, isOpen: false }));
  }, [dialogState.isPrompt]);

  const handlePromptChange = useCallback((val) => {
    setDialogState((prev) => ({ ...prev, promptValue: val }));
  }, []);

  useEffect(() => {
    globalDialogHandler = { confirm, prompt };

    // Seamless safety net: intercept native window.alert so NO "localhost says" popups ever appear
    const nativeAlert = window.alert;
    window.alert = (msg) => {
      showAlert(msg);
    };

    return () => {
      globalDialogHandler = null;
      window.alert = nativeAlert;
    };
  }, [confirm, prompt]);

  return (
    <DialogContext.Provider value={{ confirm, prompt, showAlert }}>
      {children}

      {/* Global Enterprise Toaster */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3800,
          className: 'font-sans text-xs font-semibold shadow-lg rounded-xl border border-slate-200/90',
          style: {
            background: '#ffffff',
            color: '#0f172a',
            padding: '10px 16px',
            fontSize: '12px',
          },
          success: {
            iconTheme: {
              primary: '#059669',
              secondary: '#ffffff',
            },
            style: {
              border: '1px solid #a7f3d0',
              background: '#f0fdf4',
              color: '#065f46',
            },
          },
          error: {
            iconTheme: {
              primary: '#e11d48',
              secondary: '#ffffff',
            },
            style: {
              border: '1px solid #fecdd3',
              background: '#fff1f2',
              color: '#9f1239',
            },
          },
        }}
      />

      {/* Global Custom Confirmation / Prompt Modal */}
      <ConfirmDialog
        isOpen={dialogState.isOpen}
        title={dialogState.title}
        message={dialogState.message}
        confirmText={dialogState.confirmText}
        cancelText={dialogState.cancelText}
        type={dialogState.type}
        isPrompt={dialogState.isPrompt}
        promptValue={dialogState.promptValue}
        promptPlaceholder={dialogState.promptPlaceholder}
        onPromptChange={handlePromptChange}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </DialogContext.Provider>
  );
}

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    return {
      confirm: showConfirm,
      prompt: showPrompt,
      showAlert,
    };
  }
  return context;
};
