import React, { useEffect, useState } from 'react';
import { X, Info, CheckCircle, AlertTriangle, AlertOctagon } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
    id: number;
    type: ToastType;
    message: string;
    duration?: number;
    onClose: (id: number) => void;
}

const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-500" />,
    error: <AlertOctagon className="w-5 h-5 text-red-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
};

const bgColors = {
    success: 'bg-white border-green-100',
    error: 'bg-white border-red-100',
    warning: 'bg-white border-yellow-100',
    info: 'bg-white border-blue-100'
};

const Toast: React.FC<ToastProps> = ({ id, type, message, duration = 5000, onClose }) => {
    const [isVisible, setIsVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setIsVisible(false);
            setTimeout(() => onClose(id), 300); // Wait for fade out
        }, duration);

        return () => clearTimeout(timer);
    }, [duration, id, onClose]);

    return (
        <div
            className={`
                flex items-center w-full max-w-sm p-4 mb-4 text-gray-500 rounded-lg shadow-lg border transition-all duration-300 transform
                ${bgColors[type]}
                ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}
            role="alert"
        >
            <div className="inline-flex items-center justify-center flex-shrink-0">
                {icons[type]}
            </div>
            <div className="ml-3 text-sm font-normal text-slate-700">{message}</div>
            <button
                type="button"
                className="ml-auto -mx-1.5 -my-1.5 bg-white text-gray-400 hover:text-gray-900 rounded-lg focus:ring-2 focus:ring-gray-300 p-1.5 hover:bg-gray-100 inline-flex items-center justify-center h-8 w-8"
                onClick={() => {
                    setIsVisible(false);
                    setTimeout(() => onClose(id), 300);
                }}
            >
                <span className="sr-only">Close</span>
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};

export default Toast;
