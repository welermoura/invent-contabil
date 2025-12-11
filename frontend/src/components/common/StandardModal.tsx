import React from 'react';
import { X, AlertCircle, CheckCircle, Info, AlertTriangle } from 'lucide-react';

export type ModalType = 'error' | 'warning' | 'success' | 'info' | 'confirm';

interface StandardModalProps {
    isOpen: boolean;
    type: ModalType;
    title: string;
    message: string;
    onClose: () => void;
    onConfirm?: () => void;
    confirmText?: string;
    cancelText?: string;
}

const StandardModal: React.FC<StandardModalProps> = ({
    isOpen,
    type,
    title,
    message,
    onClose,
    onConfirm,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar'
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'error': return <AlertCircle className="w-8 h-8 text-red-500" />;
            case 'success': return <CheckCircle className="w-8 h-8 text-green-500" />;
            case 'warning': return <AlertTriangle className="w-8 h-8 text-amber-500" />;
            case 'confirm': return <AlertTriangle className="w-8 h-8 text-blue-500" />;
            default: return <Info className="w-8 h-8 text-blue-500" />;
        }
    };

    const getHeaderColor = () => {
        switch (type) {
            case 'error': return 'bg-red-50 border-red-100';
            case 'success': return 'bg-green-50 border-green-100';
            case 'warning': return 'bg-amber-50 border-amber-100';
            case 'confirm': return 'bg-blue-50 border-blue-100';
            default: return 'bg-slate-50 border-slate-100';
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-white/20">

                {/* Header */}
                <div className={`p-6 border-b flex items-start gap-4 ${getHeaderColor()}`}>
                    <div className="bg-white p-2 rounded-full shadow-sm">
                        {getIcon()}
                    </div>
                    <div className="flex-1">
                        <h3 className="text-lg font-bold text-slate-800 leading-tight">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6">
                    <p className="text-slate-600 leading-relaxed text-sm md:text-base">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    {type === 'confirm' ? (
                        <>
                            <button
                                onClick={onClose}
                                className="px-4 py-2 text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={() => { onConfirm && onConfirm(); onClose(); }}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium shadow-sm transition-colors text-sm"
                            >
                                {confirmText}
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm shadow-sm"
                        >
                            Fechar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StandardModal;
