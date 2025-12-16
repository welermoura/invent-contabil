import React from 'react';
import type {
  DragStartEvent,
  DragEndEvent
} from '@dnd-kit/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, X } from 'lucide-react';

import { useDashboard } from './DashboardContext';
import { useDashboardNavigation } from '../../hooks/useDashboardNavigation';
import StatCard from './widgets/StatCard';
import ValueByBranchChart from './widgets/ValueByBranchChart';
import CountByBranchChart from './widgets/CountByBranchChart';
import ValueByCategoryChart from './widgets/ValueByCategoryChart';
import CountByCategoryChart from './widgets/CountByCategoryChart';
import EvolutionChart from './widgets/EvolutionChart';
import TopItemsTable from './widgets/TopItemsTable';
import RecentItemsTable from './widgets/RecentItemsTable';
import RiskMapWidget from './widgets/RiskMapWidget';
import PurchaseVsAccountingChart from './widgets/PurchaseVsAccountingChart';

import { DollarSign, Package, AlertCircle, FileWarning, Activity, Clock, ClipboardList } from 'lucide-react';

// Widget Registry
export const WIDGETS: Record<string, any> = {
    'kpi-total-value': { label: "KPI Valor Total", component: StatCard, type: 'kpi', props: { title: "Valor Contábil Total", icon: DollarSign, colorClass: "text-emerald-600" } },
    'kpi-total-items': { label: "KPI Total Itens", component: StatCard, type: 'kpi', props: { title: "Itens Totais", icon: Package, colorClass: "text-blue-600" } },
    'kpi-pending-items-action': { label: "KPI Itens Pendentes", component: StatCard, type: 'kpi', props: { title: "Aprovações Pendentes", icon: ClipboardList, colorClass: "text-orange-600" } },
    'kpi-pending-value': { label: "KPI Valor Pendente", component: StatCard, type: 'kpi', props: { title: "Valor Pendente", icon: AlertCircle, colorClass: "text-amber-500" } },
    'kpi-writeoff': { label: "KPI Baixas", component: StatCard, type: 'kpi', props: { title: "Baixas Pendentes", icon: FileWarning, colorClass: "text-red-500" } },

    'kpi-age': { label: "KPI Idade Média", component: StatCard, type: 'kpi', props: { title: "Idade Média (Meses)", icon: Clock, colorClass: "text-violet-500" } },
    'kpi-zero-dep': { label: "KPI Fim Vida Útil", component: StatCard, type: 'kpi', props: { title: "Fim da Vida Útil", icon: Activity, colorClass: "text-slate-500" } },

    'chart-branch': { label: "Valor por Filial", component: ValueByBranchChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },
    'chart-branch-count': { label: "Qtd. por Filial", component: CountByBranchChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },

    'chart-category': { label: "Valor por Categoria", component: ValueByCategoryChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },
    'chart-category-count': { label: "Qtd. por Categoria", component: CountByCategoryChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },

    'chart-risk': { label: "Mapa de Risco", component: RiskMapWidget, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },
    'chart-purch-vs-acc': { label: "Compra vs Contábil", component: PurchaseVsAccountingChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },

    'chart-evolution': { label: "Evolução Patrimonial", component: EvolutionChart, type: 'chart', className: 'md:col-span-2 lg:col-span-2' },

    'table-top-items': { label: "Top Itens", component: TopItemsTable, type: 'chart', className: 'md:col-span-1 lg:col-span-2' },
    'table-recent-items': { label: "Itens Recentes", component: RecentItemsTable, type: 'chart', className: 'md:col-span-1 lg:col-span-2' },
};

const DEFAULT_LAYOUT = [
    'kpi-pending-items-action', 'kpi-total-value', 'kpi-total-items', 'kpi-pending-value', 'kpi-writeoff',
    'chart-evolution',
    'chart-branch', 'chart-category',
    'table-top-items'
];

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
    className?: string;
    onRemove: (id: string) => void;
}

const SortableItem = ({ id, children, className, onRemove }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className={`relative group ${className}`}>
             {/* Drag handle and close button */}
             <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                <div
                    {...attributes}
                    {...listeners}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-400 hover:text-blue-500 cursor-grab active:cursor-grabbing hover:scale-105 transition-all"
                    title="Arrastar Widget"
                >
                    <GripVertical size={16} />
                </div>
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(id); }}
                    className="p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-400 hover:text-red-500 hover:scale-105 transition-all"
                    title="Remover Widget"
                >
                    <X size={16} />
                </button>
             </div>

            <div>
                {children}
            </div>
        </div>
    );
};

const DraggableGrid: React.FC = () => {
    const { layout, setLayout, aggregates, isLoading, isEditing, removeWidget } = useDashboard();
    const { openDetailModal } = useDashboardNavigation();
    const [activeId, setActiveId] = React.useState<string | null>(null);

    // Initial load check
    React.useEffect(() => {
        if (layout.length === 0) {
            setLayout(DEFAULT_LAYOUT);
        } else {
             // Force "Pending Items" to appear if missing (e.g. old layout in localstorage)
             if (!layout.includes('kpi-pending-items-action')) {
                setLayout(['kpi-pending-items-action', ...layout]);
             }
        }
    }, [layout, setLayout]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = layout.indexOf(active.id);
            const newIndex = layout.indexOf(over.id);
            const newLayout = arrayMove(layout, oldIndex, newIndex);
            setLayout(newLayout);
            localStorage.setItem('dashboard_layout', JSON.stringify(newLayout));
        }
        setActiveId(null);
    };

    const renderWidget = (id: string, _isOverlay = false) => {
        const def = WIDGETS[id];
        if (!def) return null;

        const Component = def.component;
        let props = def.props || {};

        // Inject dynamic data for KPIs
        if (def.type === 'kpi') {
            if (id === 'kpi-total-value') {
                props.value = aggregates.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                props.onClick = () => openDetailModal('Detalhe Valor Total', { limit: 100 });
            }
            if (id === 'kpi-total-items') {
                props.value = aggregates.totalItems;
                props.onClick = () => openDetailModal('Itens Cadastrados', { limit: 100 });
            }
            if (id === 'kpi-pending-items-action') {
                props.value = aggregates.pendingCount;
                props.subtext = "Aguardando aprovação";
                props.onClick = () => openDetailModal('Aprovações Pendentes', { status: 'PENDING', renderInventory: true });
            }
            if (id === 'kpi-pending-value') {
                props.value = aggregates.pendingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                props.subtext = `${aggregates.pendingCount} itens pendentes`;
                props.onClick = () => openDetailModal('Itens Pendentes', { status: 'PENDING' });
            }
            if (id === 'kpi-writeoff') {
                props.value = aggregates.itemsByStatus['WRITE_OFF_PENDING'] || 0;
                props.onClick = () => openDetailModal('Baixas Pendentes', { status: 'WRITE_OFF_PENDING' });
            }
            if (id === 'kpi-age') {
                props.value = aggregates.averageAssetAgeMonths.toFixed(1);
            }
            if (id === 'kpi-zero-dep') {
                props.value = aggregates.zeroDepreciationCount;
                props.onClick = () => openDetailModal('Itens Totalmente Depreciados', { zeroDepreciation: 'true' });
            }

            props.isLoading = isLoading;
        }

        return (
            <div className="h-full">
                <Component {...props} />
            </div>
        );
    };

    const items = layout.filter((id: string) => WIDGETS[id]); // Safety filter

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <SortableContext items={items} strategy={rectSortingStrategy}>
                <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-10 ${isEditing ? 'p-6 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-3xl bg-slate-50/50 dark:bg-slate-900/50 min-h-[500px]' : ''}`} id="dashboard-container">
                    {items.map((id: string) => {
                        const def = WIDGETS[id];
                        const colSpan = def?.className || 'col-span-1';

                        return (
                            <SortableItem key={id} id={id} className={colSpan} onRemove={removeWidget}>
                                {renderWidget(id)}
                            </SortableItem>
                        );
                    })}
                </div>
            </SortableContext>
            <DragOverlay>
                {activeId ? renderWidget(activeId, true) : null}
            </DragOverlay>
        </DndContext>
    );
};

export default DraggableGrid;
