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
import { GripVertical } from 'lucide-react';

import { useDashboard } from './DashboardContext';

import StatCard from './widgets/StatCard';
import ValueByBranchChart from './widgets/ValueByBranchChart';
import ValueByCategoryChart from './widgets/ValueByCategoryChart';
import EvolutionChart from './widgets/EvolutionChart';
import TopItemsTable from './widgets/TopItemsTable';
import { DollarSign, Package, AlertCircle, FileWarning } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Widget Registry
const WIDGETS: Record<string, any> = {
    'kpi-total-value': { component: StatCard, type: 'kpi', props: { title: "Valor Contábil Total", icon: DollarSign, colorClass: "text-emerald-600" } },
    'kpi-total-items': { component: StatCard, type: 'kpi', props: { title: "Itens Totais", icon: Package, colorClass: "text-blue-600" } },
    'kpi-pending-value': { component: StatCard, type: 'kpi', props: { title: "Valor Pendente", icon: AlertCircle, colorClass: "text-amber-500" } }, // Calculated in frontend now
    'kpi-writeoff': { component: StatCard, type: 'kpi', props: { title: "Baixas Pendentes", icon: FileWarning, colorClass: "text-red-500" } },
    'chart-branch': { component: ValueByBranchChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },
    'chart-category': { component: ValueByCategoryChart, type: 'chart', className: 'md:col-span-1 lg:col-span-1' },
    'chart-evolution': { component: EvolutionChart, type: 'chart', className: 'md:col-span-2 lg:col-span-2' }, // Full width
    'table-top-items': { component: TopItemsTable, type: 'chart', className: 'md:col-span-1 lg:col-span-2' }, // Wide
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
}

const SortableItem = ({ id, children, className }: SortableItemProps) => {
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
             <div
                {...attributes}
                {...listeners}
                className="absolute top-2 right-2 p-1 text-slate-300 hover:text-slate-500 cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
            >
                <GripVertical size={16} />
            </div>
            {children}
        </div>
    );
};

const DraggableGrid: React.FC = () => {
    const { layout, setLayout, aggregates, isLoading } = useDashboard();
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pb-10" id="dashboard-container">
                    {items.map((id: string) => {
                        const def = WIDGETS[id];
                        // Determine grid span based on widget definition
                        const colSpan = def?.className || 'col-span-1';

                        return (
                            <SortableItem key={id} id={id} className={colSpan}>
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
