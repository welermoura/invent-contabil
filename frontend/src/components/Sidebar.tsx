import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { useSettings } from '../context/SettingsContext';
import api from '../api';
import {
    LayoutDashboard,
    Package,
    Building2,
    Truck,
    FileText,
    Tags,
    Users as UsersIcon,
    Settings,
    Shield,
    Workflow,
    UserCheck,
    CheckSquare,
    ClipboardList,
    Briefcase,
    MapPin,
    ChevronDown,
    ChevronRight,
    LayoutGrid,
    Database,
    PieChart,
    ChevronsLeft,
    ChevronsRight
} from 'lucide-react';
import { useState } from 'react';

interface SidebarProps {
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    openSections: Record<string, boolean>;
    toggleSection: (section: string) => void;
    isCollapsed: boolean;
    setIsCollapsed: (collapsed: boolean) => void;
    disableAnimations?: boolean;
}

export default function Sidebar({
    sidebarOpen,
    setSidebarOpen,
    openSections,
    toggleSection,
    isCollapsed,
    setIsCollapsed,
    disableAnimations = false
}: SidebarProps) {
    const { user } = useAuth();
    const { settings } = useSettings();
    const location = useLocation();

    const toggleSidebar = () => {
        setIsCollapsed(!isCollapsed);
    };

    // Styles
    const sidebarBgStyle = settings.theme_primary_color ? {
        backgroundColor: settings.theme_primary_color + (settings.theme_primary_color.length === 7 ? 'E6' : ''),
    } : {};

    const sidebarTextColorClass = settings.theme_text_color || 'text-slate-600';
    const sidebarHeaderColorClass = settings.theme_text_color === 'text-white' ? 'text-white' : 'text-slate-800';

    // Novo estilo "Pílula" e Hover sutil
    const navItemHoverClass = settings.theme_text_color === 'text-white'
        ? 'hover:bg-white/10 hover:text-white'
        : 'hover:bg-blue-500/10 hover:text-blue-600';

    const activeItemClass = settings.theme_text_color === 'text-white'
        ? 'bg-white/20 text-white shadow-sm'
        : 'bg-blue-100 text-blue-700 font-medium border-l-4 border-blue-600'; // Pílula com borda ou estilo distinto

    const isActive = (path: string) => location.pathname === path;

    // Componente auxiliar para Itens de Menu
    const NavItem = ({ to, icon: Icon, label, id }: { to: string, icon: any, label: string, id?: string }) => {
        const active = isActive(to);

        return (
            <div className="relative group">
                <Link
                    to={to}
                    id={id}
                    style={{
                        // @ts-ignore - CSS Anchor Positioning is new
                        anchorName: id ? `--${id}` : undefined
                    }}
                    className={`flex items-center gap-3 px-3 py-2.5 mx-2 rounded-lg transition-all duration-200
                        ${active
                            ? activeItemClass
                            : `${sidebarTextColorClass} ${navItemHoverClass}`
                        }
                        ${isCollapsed ? 'justify-center px-2' : ''}
                    `}
                >
                    <Icon size={20} className={`shrink-0 ${active ? 'text-current' : (settings.theme_text_color === 'text-white' ? 'text-white/70 group-hover:text-white' : 'text-slate-400 group-hover:text-blue-600')}`} />

                    {!isCollapsed && (
                        <span className={`truncate text-sm ${isCollapsed ? 'hidden' : 'block'}`}>{label}</span>
                    )}
                </Link>

                {/* Tooltip para Modo Mini */}
                {isCollapsed && (
                    <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 whitespace-nowrap">
                        {label}
                    </div>
                )}
            </div>
        );
    };

    // Componente auxiliar para Seções Colapsáveis
    const SidebarSection = ({
        id,
        title,
        icon: Icon,
        children,
        sectionKey
    }: {
        id: string,
        title: string,
        icon: any,
        children: React.ReactNode,
        sectionKey: string
    }) => {
        const isOpen = openSections[sectionKey] || false;

        // No modo mini, mostra apenas um separador ou cabeçalho simplificado
        if (isCollapsed) {
            return (
                <div id={id} className="py-2 border-t border-slate-200/10 first:border-0">
                    <div className="flex justify-center mb-2" title={title}>
                       <Icon size={16} className={settings.theme_text_color === 'text-white' ? 'text-white/40' : 'text-slate-400'} />
                    </div>
                    {children}
                </div>
            );
        }

        return (
            <div id={id} className="mb-2">
                <button
                    onClick={() => toggleSection(sectionKey)}
                    className={`w-full flex items-center justify-between px-4 py-2 mb-1 text-xs font-semibold uppercase tracking-wider transition-colors hover:bg-black/5 rounded-md
                        ${settings.theme_text_color === 'text-white' ? 'text-white/70 hover:text-white' : 'text-slate-500 hover:text-slate-700'}
                    `}
                >
                    <div className="flex items-center gap-2">
                        <Icon size={14} />
                        <span>{title}</span>
                    </div>
                    {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </button>

                <div
                    className={`overflow-hidden pl-2 border-l border-white/10 ml-4
                        ${disableAnimations ? '' : 'transition-all duration-300 ease-in-out'}
                        ${isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}
                    `}
                >
                    {children}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* Sidebar */}
            <aside
                style={sidebarBgStyle}
                className={`fixed inset-y-0 left-0 z-50
                ${!settings.theme_primary_color ? 'bg-white/90' : ''}
                backdrop-blur-md border-r border-slate-200/50
                ${disableAnimations ? '' : 'transition-all duration-300 ease-in-out'}
                lg:translate-x-0 lg:static lg:inset-auto
                ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
                ${isCollapsed ? 'w-20' : 'w-64'}
                `}
            >
                {/* Header da Sidebar */}
                <div className={`flex items-center h-16 px-4 border-b transition-all duration-300 ${settings.theme_text_color === 'text-white' ? 'border-white/10' : 'border-slate-100'} ${isCollapsed ? 'justify-center' : 'justify-between'}`}>

                    {!isCollapsed && (
                        <div className="flex items-center gap-2 overflow-hidden">
                            {settings.logo_url ? (
                                <img
                                    src={`${api.defaults.baseURL}/${settings.logo_url}`}
                                    alt="Logo"
                                    className="h-8 w-auto object-contain"
                                />
                            ) : (
                                <>
                                    <div className="bg-blue-600 p-1.5 rounded-lg shrink-0">
                                        <Package className="text-white" size={20} />
                                    </div>
                                    <span className={`text-lg font-bold truncate ${settings.theme_primary_color ? sidebarHeaderColorClass : 'bg-gradient-to-r from-blue-700 to-blue-500 bg-clip-text text-transparent'}`}>
                                        Inventário
                                    </span>
                                </>
                            )}
                        </div>
                    )}

                    {/* Botão de Toggle Mini Sidebar (Apenas Desktop) */}
                    <button
                        onClick={toggleSidebar}
                        className={`hidden lg:flex p-1.5 rounded-md transition-colors
                            ${settings.theme_text_color === 'text-white' ? 'text-white/60 hover:text-white hover:bg-white/10' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'}
                        `}
                        title={isCollapsed ? "Expandir" : "Recolher"}
                    >
                        {isCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
                    </button>

                    {/* Botão Fechar Mobile */}
                    <button onClick={() => setSidebarOpen(false)} className={`lg:hidden ${settings.theme_text_color === 'text-white' ? 'text-white/70 hover:text-white' : 'text-slate-400 hover:text-slate-600'}`}>
                        ×
                    </button>
                </div>

                {/* Conteúdo Scrollável */}
                <div className={`py-4 space-y-2 overflow-y-auto h-[calc(100vh-4rem)] ${isCollapsed ? 'scrollbar-hide' : ''}`}>

                    {/* Principal */}
                    <SidebarSection
                        id="section-principal"
                        title="Principal"
                        icon={LayoutGrid}
                        sectionKey="principal"
                    >
                        <NavItem id="nav-dashboard" to="/" icon={LayoutDashboard} label="Painel" />
                        <NavItem id="nav-inventory" to="/inventory" icon={Package} label="Inventário" />
                        {(user?.role === 'OPERATOR') && (
                            <>
                                <NavItem id="nav-my-requests" to="/my-requests" icon={FileText} label="Minhas Solicitações" />
                                <NavItem id="nav-pending-actions" to="/my-pending-actions" icon={ClipboardList} label="Confirmações Pendentes" />
                            </>
                        )}
                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER' || user?.role === 'REVIEWER') && (
                            <NavItem id="nav-pending-approvals" to="/pending-approvals" icon={CheckSquare} label="Aprovações Pendentes" />
                        )}
                    </SidebarSection>

                    {/* Cadastros */}
                    <SidebarSection
                        id="section-cadastros"
                        title="Cadastros"
                        icon={Database}
                        sectionKey="cadastros"
                    >
                        <NavItem id="nav-branches" to="/branches" icon={Building2} label="Filiais" />
                        <NavItem id="nav-sectors" to="/sectors" icon={MapPin} label="Setores" />
                        {user?.role !== 'OPERATOR' && (
                            <NavItem id="nav-categories" to="/categories" icon={Tags} label="Categorias" />
                        )}
                        <NavItem id="nav-suppliers" to="/suppliers" icon={Truck} label="Fornecedores" />
                        {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                            <NavItem id="nav-cost-centers" to="/cost-centers" icon={Briefcase} label="Centros de Custo" />
                        )}
                    </SidebarSection>

                    {/* Administração */}
                    {(user?.role === 'ADMIN' || user?.role === 'APPROVER') && (
                        <SidebarSection
                            id="section-admin"
                            title="Administração"
                            icon={Settings}
                            sectionKey="administracao"
                        >
                            <NavItem id="nav-users" to="/users" icon={UsersIcon} label="Usuários" />
                            <NavItem id="nav-user-groups" to="/users/groups" icon={UserCheck} label="Grupos de Aprovação" />
                            <NavItem id="nav-approval-workflows" to="/approval-workflows" icon={Workflow} label="Malha de Aprovação" />
                            <NavItem id="nav-safeguard" to="/safeguard-settings" icon={Shield} label="Salva Guarda" />
                            {(user?.role === 'ADMIN') && (
                                <NavItem id="nav-system-settings" to="/system-settings" icon={Settings} label="Configurações" />
                            )}
                        </SidebarSection>
                    )}

                    {/* Relatórios */}
                    <SidebarSection
                        id="section-reports"
                        title="Relatórios"
                        icon={PieChart}
                        sectionKey="relatorios"
                    >
                        <NavItem id="nav-reports" to="/reports" icon={FileText} label="Relatórios" />
                    </SidebarSection>

                </div>
            </aside>

            {/* Mobile Overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm"
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}
        </>
    );
}
