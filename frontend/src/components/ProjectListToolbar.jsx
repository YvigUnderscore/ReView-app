import React, { useState } from 'react';
import { Search, Filter, LayoutGrid, List, Plus, X, ArrowDownUp, Check } from 'lucide-react';

const ProjectListToolbar = ({
    search,
    onSearchChange,
    filters,
    onFilterChange,
    sort,
    onSortChange,
    viewMode,
    onViewModeChange,
    onNewProject,
    teams = [],
    showTeamFilter = true
}) => {
    const [showFilters, setShowFilters] = useState(false);
    const [showSortMenu, setShowSortMenu] = useState(false);

    const activeFiltersCount = (filters.status.length > 0 ? 1 : 0) + (filters.teams.length > 0 ? 1 : 0) + (filters.dateFrom || filters.dateTo ? 1 : 0);

    const handleSort = (type) => {
        onSortChange(type);
        setShowSortMenu(false);
    };

    const toggleFilterArray = (type, value) => {
        const current = filters[type] || [];
        const updated = current.includes(value)
            ? current.filter(item => item !== value)
            : [...current, value];
        onFilterChange({ ...filters, [type]: updated });
    };

    return (
        <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                {/* Left: Search & Filters */}
                <div className="flex items-center gap-2 flex-1 w-full md:w-auto">
                    <div className="relative flex-1 md:max-w-xs">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <input
                            type="text"
                            placeholder="Search projects..."
                            className="w-full pl-9 pr-4 py-2 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring transition-shadow"
                            value={search}
                            onChange={(e) => onSearchChange(e.target.value)}
                        />
                    </div>

                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-md border text-sm font-medium transition-colors ${
                            showFilters || activeFiltersCount > 0
                            ? 'bg-secondary text-secondary-foreground border-secondary-foreground/20'
                            : 'bg-background hover:bg-muted border-input'
                        }`}
                    >
                        <Filter size={16} />
                        <span className="hidden sm:inline">Filters</span>
                        {activeFiltersCount > 0 && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground font-bold">
                                {activeFiltersCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Sort Dropdown */}
                    <div className="relative">
                        <button
                            onClick={() => setShowSortMenu(!showSortMenu)}
                            className="p-2 rounded-md border border-input hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Sort Projects"
                        >
                            <ArrowDownUp size={18} />
                        </button>
                        {showSortMenu && (
                            <>
                                <div className="fixed inset-0 z-30" onClick={() => setShowSortMenu(false)} />
                                <div className="absolute right-0 top-full mt-2 w-48 bg-popover border border-border rounded-md shadow-lg z-40 py-1 animate-in fade-in zoom-in-95 duration-100">
                                    <div className="px-3 py-2 text-xs font-semibold text-muted-foreground border-b border-border mb-1">Sort By</div>
                                    {[
                                        { label: 'Date: Newest First', value: 'date_desc' },
                                        { label: 'Date: Oldest First', value: 'date_asc' },
                                        { label: 'Name: A-Z', value: 'name_asc' },
                                        { label: 'Name: Z-A', value: 'name_desc' },
                                        { label: 'Status', value: 'status' },
                                    ].map(opt => (
                                        <button
                                            key={opt.value}
                                            onClick={() => handleSort(opt.value)}
                                            className="w-full text-left px-4 py-2 text-sm hover:bg-accent hover:text-accent-foreground flex items-center justify-between group"
                                        >
                                            {opt.label}
                                            {sort === opt.value && <Check size={14} className="text-primary" />}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* View Toggle */}
                    <div className="flex items-center bg-muted/50 p-1 rounded-md border border-border/50">
                        <button
                            onClick={() => onViewModeChange('grid')}
                            className={`p-1.5 rounded-sm transition-all ${viewMode === 'grid' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                            title="Grid View"
                        >
                            <LayoutGrid size={16} />
                        </button>
                        <button
                            onClick={() => onViewModeChange('list')}
                            className={`p-1.5 rounded-sm transition-all ${viewMode === 'list' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-background/50'}`}
                            title="List View"
                        >
                            <List size={16} />
                        </button>
                    </div>

                    <div className="w-px h-6 bg-border mx-1" />

                    <button
                        onClick={onNewProject}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded-md shadow-sm text-sm font-medium flex items-center gap-2 transition-transform active:scale-95"
                    >
                        <Plus size={16} />
                        <span className="hidden sm:inline">New Project</span>
                    </button>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="bg-muted/30 border border-border rounded-lg p-4 grid gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

                        {/* Status Filter */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                            <div className="flex flex-wrap gap-2">
                                {['INTERNAL_REVIEW', 'CLIENT_REVIEW', 'ALL_REVIEWS_DONE'].map(status => (
                                    <button
                                        key={status}
                                        onClick={() => toggleFilterArray('status', status)}
                                        className={`text-[11px] px-3 py-1 rounded-full border transition-all ${
                                            filters.status.includes(status)
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'bg-background text-muted-foreground border-input hover:border-primary/50'
                                        }`}
                                    >
                                        {status.replace(/_/g, ' ')}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Team Filter (Conditional) */}
                        {showTeamFilter && (
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Team</label>
                                <select
                                    className="w-full px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
                                    onChange={(e) => {
                                        if (e.target.value) toggleFilterArray('teams', parseInt(e.target.value));
                                        e.target.value = ""; // reset select
                                    }}
                                >
                                    <option value="">Select Team...</option>
                                    {teams.map(t => (
                                        <option key={t.id} value={t.id} disabled={filters.teams.includes(t.id)}>
                                            {t.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                    {filters.teams.map(tid => {
                                        const team = teams.find(t => t.id === tid);
                                        return (
                                            <span key={tid} className="inline-flex items-center gap-1 text-[10px] bg-accent text-accent-foreground px-2 py-1 rounded border border-border">
                                                {team?.name || 'Unknown Team'}
                                                <button onClick={() => toggleFilterArray('teams', tid)} className="hover:text-destructive transition-colors"><X size={12} /></button>
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Date Range */}
                        <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date Range</label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="date"
                                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-ring"
                                    value={filters.dateFrom}
                                    onChange={(e) => onFilterChange({ ...filters, dateFrom: e.target.value })}
                                />
                                <span className="text-muted-foreground">-</span>
                                <input
                                    type="date"
                                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-input rounded-md focus:ring-2 focus:ring-ring"
                                    value={filters.dateTo}
                                    onChange={(e) => onFilterChange({ ...filters, dateTo: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end pt-2 border-t border-border/50">
                        <button
                            onClick={() => onFilterChange({ status: [], teams: [], dateFrom: '', dateTo: '' })}
                            className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 hover:bg-muted rounded transition-colors"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProjectListToolbar;
