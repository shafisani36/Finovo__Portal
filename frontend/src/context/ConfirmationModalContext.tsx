import React, { createContext, useContext, useState, useRef, useCallback } from 'react';
import { DeleteConfirmationModal } from '../components/ui/DeleteConfirmationModal';

export interface ConfirmOptions {
  title?: string;
  message?: React.ReactNode;
  itemName?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

export interface AlertOptions {
  title?: string;
  message: React.ReactNode;
  confirmText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
}

interface ConfirmationContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
}

const ConfirmationContext = createContext<ConfirmationContextValue | null>(null);

export const ConfirmationModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [modalState, setModalState] = useState<{
    isOpen: boolean;
    title: string;
    message: React.ReactNode;
    itemName?: string;
    confirmText: string;
    cancelText: string;
    variant: 'danger' | 'warning' | 'info' | 'success';
    singleActionOnly: boolean;
  }>({
    isOpen: false,
    title: 'Confirm',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger',
    singleActionOnly: false,
  });

  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      setModalState({
        isOpen: true,
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure you want to proceed?',
        itemName: options.itemName,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'danger',
        singleActionOnly: false,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      resolverRef.current = () => resolve();
      const isString = typeof options === 'string';
      setModalState({
        isOpen: true,
        title: (!isString && options.title) || 'Notification',
        message: isString ? options : options.message,
        confirmText: (!isString && options.confirmText) || 'Got It',
        cancelText: '',
        variant: (!isString && options.variant) || 'info',
        singleActionOnly: true,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const handleCancel = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  return (
    <ConfirmationContext.Provider value={{ confirm, alert }}>
      {children}

      <DeleteConfirmationModal
        isOpen={modalState.isOpen}
        title={modalState.title}
        message={modalState.message}
        itemName={modalState.itemName}
        confirmText={modalState.confirmText}
        cancelText={modalState.cancelText}
        variant={modalState.variant}
        singleActionOnly={modalState.singleActionOnly}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmationContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmationContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmationModalProvider');
  }
  return context;
};
