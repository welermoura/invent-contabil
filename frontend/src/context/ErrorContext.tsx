import React, { createContext, useContext, useState, ReactNode } from 'react';
import StandardModal from '../components/common/StandardModal';
import type { ModalType } from '../components/common/StandardModal';
import { ERROR_MAPPING, getErrorMessage } from '../utils/errorMap';

interface ErrorContextProps {
    showError: (error: any, customKey?: string) => void;
    showSuccess: (message: string, title?: string) => void;
    showWarning: (message: string, title?: string) => void;
    showConfirm: (message: string, onConfirm: () => void, title?: string) => void;
}

export const ErrorContext = createContext<ErrorContextProps>({
    showError: () => {},
    showSuccess: () => {},
    showWarning: () => {},
    showConfirm: () => {},
});

export const useError = () => useContext(ErrorContext);

export const ErrorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        type: ModalType;
        title: string;
        message: string;
        onConfirm?: () => void;
    }>({
        type: 'info',
        title: '',
        message: ''
    });

    const openModal = (type: ModalType, title: string, message: string, onConfirm?: () => void) => {
        setModalConfig({ type, title, message, onConfirm });
        setIsOpen(true);
    };

    const showError = (error: any, customKey?: string) => {
        // Se for string direta
        if (typeof error === 'string') {
             // Checa se é uma chave do mapa
             if (ERROR_MAPPING[error]) {
                 const mapped = ERROR_MAPPING[error];
                 openModal(mapped.severity as ModalType, mapped.title, mapped.message);
             } else {
                 // Texto livre
                 openModal('error', 'Erro', error);
             }
             return;
        }

        // Se for objeto de erro
        const mapped = getErrorMessage(error, customKey);
        // Se a mensagem do backend for específica e não mapeada, use-a se disponível
        let finalMessage = mapped.message;
        if (error?.response?.data?.detail && !ERROR_MAPPING[error.response.data.detail]) {
             // Use backend message specifically if we trust it, or generic if we want strict enforcement.
             // Request says: "Backend returns error -> Frontend identifies -> Translates".
             // We prioritize the Map, but fallback to detail if useful?
             // The prompt asks to replace generic messages. Specific backend messages might be good.
             // Let's stick to mapped for now to enforce standard.
             // Exception: Validation errors often come as details.
             // Let's append backend detail if it exists and we used a generic fallback.
             if (mapped === ERROR_MAPPING['DEFAULT_ERROR'] || mapped === ERROR_MAPPING['USER_SAVE_ERROR']) {
                 finalMessage = `${mapped.message} (${error.response.data.detail})`;
             }
        }

        openModal(mapped.severity as ModalType, mapped.title, finalMessage);
    };

    const showSuccess = (message: string, title = 'Sucesso') => {
        openModal('success', title, message);
    };

    const showWarning = (message: string, title = 'Atenção') => {
        openModal('warning', title, message);
    };

    const showConfirm = (message: string, onConfirm: () => void, title = 'Confirmação') => {
        openModal('confirm', title, message, onConfirm);
    };

    return (
        <ErrorContext.Provider value={{ showError, showSuccess, showWarning, showConfirm }}>
            {children}
            <StandardModal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                {...modalConfig}
            />
        </ErrorContext.Provider>
    );
};
