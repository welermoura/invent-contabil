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
import { GripVertical, X, Maximize2 } from 'lucide-react';

import { useDashboard, WidgetSize } from './DashboardContext';

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

import { DollarSign, Package, AlertCircle, FileWarning, Activity, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Widget Registry
export const WIDGETS: Record<string, any> = {
    'kpi-total-value': { label: "KPI Valor Total", component: StatCard, type: 'kpi', props: { title: "Valor Contábil Total", icon: DollarSign, colorClass: "text-emerald-600" } },
    'kpi-total-items': { label: "KPI Total Itens", component: StatCard, type: 'kpi', props: { title: "Itens Totais", icon: Package, colorClass: "text-blue-600" } },
    'kpi-pending-value': { label: "KPI Valor Pendente", component: StatCard, type: 'kpi', props: { title: "Valor Pendente", icon: AlertCircle, colorClass: "text-amber-500" } },
    'kpi-writeoff': { label: "KPI Baixas", component: StatCard, type: 'kpi', props: { title: "Baixas Pendentes", icon: FileWarning, colorClass: "text-red-500" } },

    'kpi-age': { label: "KPI Idade Média", component: StatCard, type: 'kpi', props: { title: "Idade Média (Meses)", icon: Clock, colorClass: "text-violet-500" } },
    'kpi-zero-dep': { label: "KPI Fim Vida Útil", component: StatCard, type: 'kpi', props: { title: "Fim da Vida Útil", icon: Activity, colorClass: "text-slate-500" } },

    'chart-branch': { label: "Valor por Filial", component: ValueByBranchChart, type: 'chart', defaultSize: 'S' },
    'chart-branch-count': { label: "Qtd. por Filial", component: CountByBranchChart, type: 'chart', defaultSize: 'S' },

    'chart-category': { label: "Valor por Categoria", component: ValueByCategoryChart, type: 'chart', defaultSize: 'S' },
    'chart-category-count': { label: "Qtd. por Categoria", component: CountByCategoryChart, type: 'chart', defaultSize: 'S' },

    'chart-risk': { label: "Mapa de Risco", component: RiskMapWidget, type: 'chart', defaultSize: 'S' },
    'chart-purch-vs-acc': { label: "Compra vs Contábil", component: PurchaseVsAccountingChart, type: 'chart', defaultSize: 'S' },

    'chart-evolution': { label: "Evolução Patrimonial", component: EvolutionChart, type: 'chart', defaultSize: 'M' },

    'table-top-items': { label: "Top Itens", component: TopItemsTable, type: 'chart', defaultSize: 'M' },
    'table-recent-items': { label: "Itens Recentes", component: RecentItemsTable, type: 'chart', defaultSize: 'M' },
};

const DEFAULT_LAYOUT = [
    'kpi-total-value', 'kpi-total-items', 'kpi-pending-value', 'kpi-writeoff',
    'chart-evolution',
    'chart-branch', 'chart-category',
    'table-top-items'
];

interface SortableItemProps {
    id: string;
    children: React.ReactNode;
    className?: string;
    isEditing: boolean;
    onRemove: (id: string) => void;
    onResize: (id: string) => void;
    size: WidgetSize;
}

const SortableItem = ({ id, children, className, isEditing, onRemove, onResize, size }: SortableItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id, disabled: !isEditing });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 50 : 'auto',
        opacity: isDragging ? 0.5 : 1,
    };

    const sizeLabels = { 'S': 'Pequeno', 'M': 'Médio', 'L': 'Grande' };

    return (
        <div ref={setNodeRef} style={style} className={`relative group ${className} ${isEditing ? 'ring-2 ring-blue-500/20 rounded-xl bg-blue-50/50 dark:bg-blue-900/10' : ''} min-w-0`}>
             {isEditing && (
                 <>
                    {/* Drag Handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="absolute top-2 right-2 p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-400 hover:text-blue-500 cursor-grab active:cursor-grabbing z-20 hover:scale-105 transition-all"
                    >
                        <GripVertical size={16} />
                    </div>

                    {/* Remove Button */}
                    <button
                        onClick={() => onRemove(id)}
                        className="absolute top-2 left-2 p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-400 hover:text-red-500 z-20 hover:scale-105 transition-all"
                    >
                        <X size={16} />
                    </button>

                    {/* Resize Button (Only for charts/tables, not KPIs) */}
                    {WIDGETS[id].type !== 'kpi' && (
                        <button
                            onClick={() => onResize(id)}
                            className="absolute bottom-2 right-2 p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm text-slate-400 hover:text-purple-500 z-20 hover:scale-105 transition-all flex items-center gap-1"
                            title={`Tamanho Atual: ${sizeLabels[size]}`}
                        >
                            <span className="text-[10px] font-bold uppercase">{size}</span>
                            <Maximize2 size={14} />
                        </button>
                    )}
                 </>
             )}
            <div className={isEditing ? 'pointer-events-none' : 'h-full'}>
                {children}
            </div>
        </div>
    );
};

const DraggableGrid: React.FC = () => {
    const { layout, setLayout, aggregates, isLoading, isEditing, removeWidget, widgetSizes, setWidgetSize } = useDashboard();
    const navigate = useNavigate();
    const [activeId, setActiveId] = React.useState<string | null>(null);

    // Initial load check
    React.useEffect(() => {
        if (layout.length === 0) {
            setLayout(DEFAULT_LAYOUT);
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

    const cycleSize = (id: string) => {
        const currentSize = widgetSizes[id] || WIDGETS[id].defaultSize || 'S';
        let newSize: WidgetSize = 'S';
        if (currentSize === 'S') newSize = 'M';
        else if (currentSize === 'M') newSize = 'L';
        else newSize = 'S';

        setWidgetSize(id, newSize);
    };

    const getWidgetClass = (id: string) => {
        const def = WIDGETS[id];
        if (def.type === 'kpi') return 'col-span-1';

        const size = widgetSizes[id] || def.defaultSize || 'S';

        switch (size) {
            case 'S': return 'md:col-span-1 lg:col-span-1'; // 1 col
            case 'M': return 'md:col-span-2 lg:col-span-2'; // 2 cols
            case 'L': return 'md:col-span-2 lg:col-span-4'; // Full width
            default: return 'md:col-span-1 lg:col-span-1';
        }
    };

    const renderWidget = (id: string, _isOverlay = false) => {
        const def = WIDGETS[id];
        if (!def) return null;

        const Component = def.component;
        let props = def.props || {};

        // Inject dynamic data for KPIs
        if (def.type === 'kpi') {
            if (id === 'kpi-total-value') props.value = aggregates.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            if (id === 'kpi-total-items') props.value = aggregates.totalItems;
            if (id === 'kpi-pending-value') {
                props.value = aggregates.pendingValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                props.subtext = `${aggregates.pendingCount} itens pendentes`;
                props.onClick = () => navigate('/inventory?status=PENDING');
            }
            if (id === 'kpi-writeoff') {
                props.value = aggregates.itemsByStatus['WRITE_OFF_PENDING'] || 0;
                props.onClick = () => navigate('/inventory?status=WRITE_OFF_PENDING');
            }
            if (id === 'kpi-age') {
                props.value = aggregates.averageAssetAgeMonths.toFixed(1);
            }
            if (id === 'kpi-zero-dep') {
                props.value = aggregates.zeroDepreciationCount;
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
                        const className = getWidgetClass(id);
                        const size = widgetSizes[id] || WIDGETS[id]?.defaultSize || 'S';

                        return (
                            <SortableItem
                                key={id}
                                id={id}
                                className={className}
                                isEditing={isEditing}
                                onRemove={removeWidget}
                                onResize={cycleSize}
                                size={size}
                            >
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
