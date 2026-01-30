import React from 'react';
import type { TooltipRenderProps } from 'react-joyride';

export const TutorialTooltip = ({
    continuous,
    index,
    step,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    size,
    isLastStep,
}: TooltipRenderProps) => {
    // Basic support for CSS Anchor Positioning API if anchor data is present
    const anchorStyle = step.data?.anchor ? {
        // @ts-ignore
        position: 'fixed',
        // @ts-ignore
        positionAnchor: `--${step.data.anchor}`,
        // @ts-ignore
        top: 'anchor(top)',
        // @ts-ignore
        left: 'anchor(right)',
        // @ts-ignore
        marginLeft: '12px', // gap
        // @ts-ignore
        alignSelf: 'start',
        // @ts-ignore
        transform: 'none', // Override lib transform
        // @ts-ignore
        inset: 'auto' // Override lib inset
    } : {};

    return (
        <div
            {...tooltipProps}
            className="bg-white rounded-xl shadow-xl p-4 max-w-sm border border-slate-100 flex flex-col gap-3"
            style={{
                zIndex: 1000,
                ...anchorStyle
            }}
        >
            <div className="flex justify-between items-center border-b border-slate-100 pb-2">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                    Passo {index + 1} de {size}
                </span>
                <button {...closeProps} className="text-slate-400 hover:text-slate-600">
                    <span className="sr-only">Fechar</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            </div>

            <div className="text-sm text-slate-600 leading-relaxed">
                {step.content}
            </div>

            <div className="flex justify-between items-center pt-2 mt-2 border-t border-slate-50">
                {!isLastStep && (
                    <button {...closeProps} className="text-xs font-medium text-slate-400 hover:text-slate-600">
                        Pular
                    </button>
                )}

                <div className="flex gap-2 ml-auto">
                    {index > 0 && (
                        <button
                            {...backProps}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Anterior
                        </button>
                    )}
                    <button
                        {...primaryProps}
                        className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm shadow-blue-500/30"
                    >
                        {isLastStep ? 'Concluir' : 'Próximo'}
                    </button>
                </div>
            </div>
        </div>
    );
};
