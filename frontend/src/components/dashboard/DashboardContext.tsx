import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import api from '../../api';
import { useAuth } from '../../AuthContext';
import type { DateRange } from './ui/DateRangePicker';

interface DashboardContextType {
    isLoading: boolean;
    items: any[];
    filteredItems: any[];
    filters: {
        branches: (string | number)[];
        categories: (string | number)[];
        status: string[];
        dateRange: DateRange;
        search: string;
        valueRange: { min: number | null, max: number | null };
    };
    setFilters: React.Dispatch<React.SetStateAction<{
        branches: (string | number)[];
        categories: (string | number)[];
        status: string[];
        dateRange: DateRange;
        search: string;
        valueRange: { min: number | null, max: number | null };
    }>>;
    availableBranches: any[];
    availableCategories: any[];
    aggregates: {
        totalValue: number;
        totalPurchaseValue: number;
        totalItems: number;
        pendingValue: number;
        pendingCount: number;
        averageAssetAgeMonths: number;
        zeroDepreciationCount: number;
        valueByBranch: { [key: string]: number };
        valueByCategory: { [key: string]: number };
        countByBranch: { [key: string]: number };
        countByCategory: { [key: string]: number };
        itemsByStatus: { [key: string]: number };
        topItems: any[];
        recentItems: any[];
    };
    refreshData: () => void;
    layout: any[];
    setLayout: (layout: any[]) => void;
    isEditing: boolean;
    setIsEditing: (isEditing: boolean) => void;
    theme: 'light' | 'dark';
    toggleTheme: () => void;
    addWidget: (widgetId: string) => void;
    removeWidget: (widgetId: string) => void;
    resetLayout: () => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [rawItems, setRawItems] = useState<any[]>([]);
    const [availableBranches, setAvailableBranches] = useState<any[]>([]);
    const [availableCategories, setAvailableCategories] = useState<any[]>([]);

    // Filters
    const [filters, setFilters] = useState({
        branches: [] as (string | number)[],
        categories: [] as (string | number)[],
        status: [] as string[],
        dateRange: { startDate: null, endDate: null, label: 'Todo o Período' } as DateRange,
        search: '',
        valueRange: { min: null, max: null } as { min: number | null, max: number | null },
    });

    // Theme & Layout
    const [theme, setTheme] = useState<'light' | 'dark'>(() =>
        (localStorage.getItem('dashboard_theme') as 'light' | 'dark') || 'light'
    );
    const [isEditing, setIsEditing] = useState(false);

    const getDefaultLayout = () => {
         // Role-based default layouts
         if (user?.role === 'OPERATOR') {
             return [
                'kpi-total-items', 'kpi-writeoff',
                'chart-branch-count', 'chart-category-count'
            ];
        }

        if (user?.role === 'AUDITOR') {
             return [
                'kpi-total-value', 'kpi-pending-value',
                'chart-evolution',
                'chart-branch', 'table-top-items'
            ];
        }

        // Default Admin/Approver
        return [
            'kpi-total-value', 'kpi-total-items', 'kpi-pending-value', 'kpi-writeoff',
            'chart-evolution',
            'chart-branch', 'chart-category',
            'table-top-items'
        ];
    };

    const [layout, setLayout] = useState(() => {
        const saved = localStorage.getItem('dashboard_layout');
        if (saved) return JSON.parse(saved);
        return getDefaultLayout();
    });

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        localStorage.setItem('dashboard_theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const addWidget = (widgetId: string) => {
        if (!layout.includes(widgetId)) {
            const newLayout = [...layout, widgetId];
            setLayout(newLayout);
            localStorage.setItem('dashboard_layout', JSON.stringify(newLayout));
        }
    };

    const removeWidget = (widgetId: string) => {
        const newLayout = layout.filter((id: string) => id !== widgetId);
        setLayout(newLayout);
        localStorage.setItem('dashboard_layout', JSON.stringify(newLayout));
    };

    const resetLayout = () => {
        const def = getDefaultLayout();
        setLayout(def);
        localStorage.setItem('dashboard_layout', JSON.stringify(def));
    };

    // Data Fetching
    const fetchData = async () => {
        setIsLoading(true);
        try {
            // Fetch metadata
            const [branchesRes, categoriesRes] = await Promise.all([
                api.get('/branches/'),
                api.get('/categories/')
            ]);
            setAvailableBranches(branchesRes.data);
            setAvailableCategories(categoriesRes.data);

            // Fetch Items
            let allItems: any[] = [];
            let skip = 0;
            const limit = 1000; // Chunk size
            let keepFetching = true;

            while (keepFetching) {
                const itemsRes = await api.get(`/items/?limit=${limit}&skip=${skip}`);
                const data = itemsRes.data;
                allItems = [...allItems, ...data];

                if (data.length < limit) {
                    keepFetching = false;
                } else {
                    skip += limit;
                }

                // Safety break
                if (allItems.length > 20000) break;
            }

            setRawItems(allItems);

        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Aggregation Logic
    const { filteredItems, aggregates } = useMemo(() => {
        let filtered = rawItems;

        // 1. Branch Filter
        if (filters.branches.length > 0) {
            filtered = filtered.filter((item: any) => filters.branches.includes(item.branch_id));
        }

        // 2. Category Filter
        if (filters.categories.length > 0) {
            filtered = filtered.filter((item: any) =>
                item.category_rel ? filters.categories.includes(item.category_rel.id) : false
            );
        }

        // 3. Status Filter
        if (filters.status.length > 0) {
            filtered = filtered.filter((item: any) => filters.status.includes(item.status));
        }

        // 4. Value Range Filter
        if (filters.valueRange.min !== null) {
            filtered = filtered.filter((item: any) => (item.accounting_value || 0) >= (filters.valueRange.min as number));
        }
        if (filters.valueRange.max !== null) {
            filtered = filtered.filter((item: any) => (item.accounting_value || 0) <= (filters.valueRange.max as number));
        }

        // 5. Search
        if (filters.search) {
            const lowerSearch = filters.search.toLowerCase();
            filtered = filtered.filter((item: any) =>
                item.description.toLowerCase().includes(lowerSearch) ||
                (item.fixed_asset_number && item.fixed_asset_number.toLowerCase().includes(lowerSearch))
            );
        }

        // 6. Date Range (Purchase Date)
        if (filters.dateRange.startDate && filters.dateRange.endDate) {
            const start = filters.dateRange.startDate.getTime();
            const end = filters.dateRange.endDate.getTime();
            filtered = filtered.filter((item: any) => {
                const pDate = new Date(item.purchase_date).getTime();
                return pDate >= start && pDate <= end;
            });
        }

        // --- Aggregations ---
        let totalValue = 0;
        let totalPurchaseValue = 0;
        let totalItems = 0;
        let pendingValue = 0;
        let pendingCount = 0;
        let totalAgeMonths = 0;
        let zeroDepreciationCount = 0;

        const valueByBranch: Record<string, number> = {};
        const valueByCategory: Record<string, number> = {};
        const countByBranch: Record<string, number> = {};
        const countByCategory: Record<string, number> = {};
        const itemsByStatus: Record<string, number> = {};

        const now = new Date().getTime();

        filtered.forEach((item: any) => {
            const val = item.accounting_value || 0;
            const purchVal = item.invoice_value || 0;

            // Totals
            totalValue += val;
            totalPurchaseValue += purchVal;
            totalItems += 1;

            if (val === 0) zeroDepreciationCount += 1;

            if (item.purchase_date) {
                 const pDate = new Date(item.purchase_date).getTime();
                 const ageMonths = (now - pDate) / (1000 * 60 * 60 * 24 * 30.44); // Approx months
                 if (ageMonths > 0) totalAgeMonths += ageMonths;
            }

            // Pending
            if (item.status === 'PENDING' || item.status === 'WRITE_OFF_PENDING' || item.status === 'TRANSFER_PENDING') {
                pendingCount += 1;
                pendingValue += val;
            }

            // By Branch
            const branchName = item.branch ? item.branch.name : 'Sem Filial';
            valueByBranch[branchName] = (valueByBranch[branchName] || 0) + val;
            countByBranch[branchName] = (countByBranch[branchName] || 0) + 1;

            // By Category
            const catName = item.category || 'Sem Categoria';
            valueByCategory[catName] = (valueByCategory[catName] || 0) + val;
            countByCategory[catName] = (countByCategory[catName] || 0) + 1;

            // By Status
            itemsByStatus[item.status] = (itemsByStatus[item.status] || 0) + 1;
        });

        // Top Items (Sort by Value)
        const topItems = [...filtered]
            .sort((a: any, b: any) => (b.accounting_value || 0) - (a.accounting_value || 0))
            .slice(0, 10);

        // Recent Items (Sort by ID desc as proxy for recency if created_at not available, or purchase_date)
        const recentItems = [...filtered]
             .sort((a: any, b: any) => (b.id || 0) - (a.id || 0))
             .slice(0, 10);

        return {
            filteredItems: filtered,
            aggregates: {
                totalValue,
                totalPurchaseValue,
                totalItems,
                pendingValue,
                pendingCount,
                averageAssetAgeMonths: totalItems > 0 ? totalAgeMonths / totalItems : 0,
                zeroDepreciationCount,
                valueByBranch,
                valueByCategory,
                countByBranch,
                countByCategory,
                itemsByStatus,
                topItems,
                recentItems
            }
        };

    }, [rawItems, filters]);

    return (
        <DashboardContext.Provider value={{
            isLoading,
            items: rawItems,
            filteredItems,
            filters,
            setFilters,
            availableBranches,
            availableCategories,
            aggregates,
            refreshData: fetchData,
            layout,
            setLayout,
            isEditing,
            setIsEditing,
            theme,
            toggleTheme,
            addWidget,
            removeWidget,
            resetLayout
        }}>
            {children}
        </DashboardContext.Provider>
    );
};

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (!context) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
};
