'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '@/lib/supabase';
import type { Investor, InvestorUI, Status } from '@/lib/types';
import { toInvestorUI } from '@/lib/types';
import { Sun, Moon } from 'lucide-react';

const STATUSES: Status[] = ['Lead', 'First Meeting', 'Partner Meeting', 'Term Sheet', 'Passed'];
const TRADITIONAL_FIELDS = ['name', 'status', 'fit', 'fundSize', 'nextSteps', 'notes', 'amount', 'primaryContact', 'firmContact'];

// Column metadata for traditional mode
const TRADITIONAL_COLUMNS = [
  { key: 'name', label: 'Investor', width: 180 },
  { key: 'status', label: 'Status', width: 120 },
  { key: 'fit', label: 'Fit', width: 50 },
  { key: 'fundSize', label: 'Fund Size', width: 100 },
  { key: 'nextSteps', label: 'Next Steps', width: 180 },
  { key: 'notes', label: 'Notes', width: 200 },
  { key: 'amount', label: 'Amount', width: 80 },
  { key: 'primaryContact', label: 'VC Contact', width: 120 },
  { key: 'firmContact', label: 'Our Contact', width: 100 },
];


const STATUS_COLORS: Record<Status, { bg: string; text: string; border: string }> = {
  'Lead': { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: '#6366f1' },
  'First Meeting': { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: '#22c55e' },
  'Partner Meeting': { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: '#eab308' },
  'Term Sheet': { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: '#06b6d4' },
  'Passed': { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: '#ef4444' },
};

// Theme color schemes
type Theme = 'light' | 'dark';

interface ThemeColors {
  background: string;
  headerBorder: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  borderLight: string;
  cellHover: string;
  inputBg: string;
  inputShadow: string;
  sectionHover: string;
  placeholder: string;
  modalBg: string;
  modalBorder: string;
  selectOptionBg: string;
}

const THEMES: Record<Theme, ThemeColors> = {
  dark: {
    background: '#0a0a0f',
    headerBorder: '#1a1a2a',
    text: '#ffffff',
    textSecondary: '#a0a0b0',
    textTertiary: '#5a5a6a',
    border: '#1a1a2a',
    borderLight: '#151520',
    cellHover: 'rgba(255,255,255,0.02)',
    inputBg: 'rgba(99, 102, 241, 0.1)',
    inputShadow: 'rgba(99, 102, 241, 0.3)',
    sectionHover: 'rgba(255,255,255,0.03)',
    placeholder: '#3a3a4a',
    modalBg: '#0f0f18',
    modalBorder: '#2a2a3a',
    selectOptionBg: '#1a1a2e',
  },
  light: {
    background: '#ffffff',
    headerBorder: '#e5e7eb',
    text: '#111827',
    textSecondary: '#4b5563',
    textTertiary: '#9ca3af',
    border: '#e5e7eb',
    borderLight: '#f3f4f6',
    cellHover: 'rgba(0,0,0,0.02)',
    inputBg: 'rgba(99, 102, 241, 0.08)',
    inputShadow: 'rgba(99, 102, 241, 0.25)',
    sectionHover: 'rgba(0,0,0,0.03)',
    placeholder: '#d1d5db',
    modalBg: '#f9fafb',
    modalBorder: '#e5e7eb',
    selectOptionBg: '#ffffff',
  },
};

interface FundraiseTrackerProps {
  listId: string;
  listName: string;
  listSlug: string;
  initialInvestors: Investor[];
  initialColumnOrder: string[] | null;
}


export default function FundraiseTracker({ listId, listName, listSlug, initialInvestors, initialColumnOrder }: FundraiseTrackerProps) {
  const [investors, setInvestors] = useState<InvestorUI[]>(() =>
    initialInvestors.map(toInvestorUI)
  );
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [columnOrder, setColumnOrder] = useState<string[]>([]);
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dropSide, setDropSide] = useState<'left' | 'right'>('left');
  const [editingColumnKey, setEditingColumnKey] = useState<string | null>(null);
  const [editingColumnValue, setEditingColumnValue] = useState<string>('');
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  // Load theme from localStorage after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('fundraise-theme') as Theme | null;
    if (savedTheme === 'light' || savedTheme === 'dark') {
      setTheme(savedTheme);
    }
  }, []);

  // Update body background when theme changes
  useEffect(() => {
    if (mounted) {
      document.body.style.background = THEMES[theme].background;
    }
  }, [theme, mounted]);

  // Save theme to localStorage when it changes
  const toggleTheme = () => {
    setTheme(prev => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      localStorage.setItem('fundraise-theme', newTheme);
      return newTheme;
    });
  };

  const colors = THEMES[theme];

  // Detect if we're using custom fields (dynamic columns) or traditional fixed columns
  const useCustomFields = useMemo(() => {
    return investors.some(inv => inv.customFields && Object.keys(inv.customFields).length > 0);
  }, [investors]);

  // Extract dynamic column names from custom fields
  const dynamicColumns = useMemo(() => {
    if (!useCustomFields) return [];
    const columnSet = new Set<string>();
    investors.forEach(inv => {
      if (inv.customFields) {
        Object.keys(inv.customFields).forEach(key => columnSet.add(key));
      }
    });
    return Array.from(columnSet).map(key => ({ key, label: key, width: 150 }));
  }, [investors, useCustomFields]);

  const columns = useMemo(() => {
    if (useCustomFields) {
      return [
        { key: 'status', label: 'Status', width: 120 },
        ...dynamicColumns,
      ];
    }
    return TRADITIONAL_COLUMNS;
  }, [useCustomFields, dynamicColumns]);

  // Initialize column order from database or default order
  useEffect(() => {
    if (initialColumnOrder && initialColumnOrder.length > 0) {
      setColumnOrder(initialColumnOrder);
    } else {
      setColumnOrder(columns.map(col => col.key));
    }
  }, [initialColumnOrder, columns]);

  // Save column order to database when it changes
  const saveColumnOrder = useCallback(async (newOrder: string[]) => {
    try {
      await fetch(`/api/lists/${listId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_order: newOrder }),
      });
    } catch (error) {
      console.error('Failed to save column order:', error);
    }
  }, [listId]);

  // Rename a column (updates all investors' custom_fields)
  const renameColumn = useCallback(async (oldKey: string, newLabel: string) => {
    if (oldKey === newLabel || !newLabel.trim()) return;
    if (oldKey === 'status' || !useCustomFields) return; // Can't rename status column or traditional columns

    // Update local state
    setInvestors(prev => prev.map(inv => {
      if (!inv.customFields || !inv.customFields[oldKey]) return inv;

      const newCustomFields = { ...inv.customFields };
      newCustomFields[newLabel] = newCustomFields[oldKey];
      delete newCustomFields[oldKey];

      return { ...inv, customFields: newCustomFields };
    }));

    // Update all investors in the database
    try {
      const updatePromises = investors.map(async (inv) => {
        if (!inv.customFields || !inv.customFields[oldKey]) return;

        const newCustomFields = { ...inv.customFields };
        newCustomFields[newLabel] = newCustomFields[oldKey];
        delete newCustomFields[oldKey];

        await fetch(`/api/investors/${inv.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ custom_fields: newCustomFields }),
        });
      });

      await Promise.all(updatePromises);

      // Update column order to reflect new name
      const newColumnOrder = columnOrder.map(key => key === oldKey ? newLabel : key);
      setColumnOrder(newColumnOrder);
      await saveColumnOrder(newColumnOrder);

    } catch (error) {
      console.error('Failed to rename column:', error);
    }
  }, [listId, investors, useCustomFields, columnOrder, saveColumnOrder]);

  // Get ordered columns based on saved order
  const orderedColumns = useMemo(() => {
    if (columnOrder.length === 0) return columns;

    // Create a map for quick lookup
    const columnMap = new Map(columns.map(col => [col.key, col]));

    // Filter and map to ensure all columns exist
    const ordered = columnOrder
      .map(key => columnMap.get(key))
      .filter((col): col is typeof columns[0] => col !== undefined);

    // Add any new columns that aren't in the saved order
    const orderedKeys = new Set(ordered.map(col => col.key));
    const newColumns = columns.filter(col => !orderedKeys.has(col.key));

    return [...ordered, ...newColumns];
  }, [columns, columnOrder]);

  // Use either traditional or dynamic fields (using ordered columns)
  const FIELDS = useMemo(() => {
    if (useCustomFields) {
      return orderedColumns.map(col => col.key);
    }
    return TRADITIONAL_FIELDS;
  }, [useCustomFields, orderedColumns]);


  // Track which cell is being edited to ignore realtime updates for it
  const editingCellRef = useRef<{ id: string; field: string } | null>(null);

  // Keep editingCellRef in sync
  useEffect(() => {
    editingCellRef.current = editingCell;
  }, [editingCell]);

  // Subscribe to realtime updates
  useEffect(() => {
    const channel = supabase
      .channel(`investors-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'investors',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newInvestor = toInvestorUI(payload.new as Investor);
            setInvestors(prev => {
              if (prev.some(inv => inv.id === newInvestor.id)) return prev;
              return [...prev, newInvestor];
            });
          } else if (payload.eventType === 'UPDATE') {
            const updatedInvestor = toInvestorUI(payload.new as Investor);
            setInvestors(prev =>
              prev.map(inv => {
                if (inv.id !== updatedInvestor.id) return inv;
                // If this investor is being edited, only update non-edited fields
                if (editingCellRef.current?.id === inv.id) {
                  const editingField = editingCellRef.current.field;
                  return {
                    ...updatedInvestor,
                    [editingField]: inv[editingField as keyof InvestorUI],
                  };
                }
                return updatedInvestor;
              })
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as { id: string }).id;
            setInvestors(prev => prev.filter(inv => inv.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  // Build ordered list of visible investors
  const visibleInvestors = useMemo(() => {
    const result: InvestorUI[] = [];
    STATUSES.forEach(status => {
      if (!collapsedSections[status]) {
        investors.filter(inv => inv.status === status).forEach(inv => result.push(inv));
      }
    });
    return result;
  }, [investors, collapsedSections]);

  const navigateToCell = useCallback((currentId: string, currentField: string, direction: string) => {
    const currentFieldIndex = FIELDS.indexOf(currentField);
    const currentRowIndex = visibleInvestors.findIndex(inv => inv.id === currentId);

    if (direction === 'right') {
      const nextFieldIndex = currentFieldIndex + 1;
      if (nextFieldIndex < FIELDS.length) {
        setEditingCell({ id: currentId, field: FIELDS[nextFieldIndex] });
      } else {
        const nextRowIndex = currentRowIndex + 1;
        if (nextRowIndex < visibleInvestors.length) {
          setEditingCell({ id: visibleInvestors[nextRowIndex].id, field: FIELDS[0] });
        } else {
          setEditingCell(null);
        }
      }
    } else if (direction === 'left') {
      const prevFieldIndex = currentFieldIndex - 1;
      if (prevFieldIndex >= 0) {
        setEditingCell({ id: currentId, field: FIELDS[prevFieldIndex] });
      } else {
        const prevRowIndex = currentRowIndex - 1;
        if (prevRowIndex >= 0) {
          setEditingCell({ id: visibleInvestors[prevRowIndex].id, field: FIELDS[FIELDS.length - 1] });
        } else {
          setEditingCell(null);
        }
      }
    } else if (direction === 'down') {
      const nextRowIndex = currentRowIndex + 1;
      if (nextRowIndex < visibleInvestors.length) {
        setEditingCell({ id: visibleInvestors[nextRowIndex].id, field: currentField });
      } else {
        setEditingCell(null);
      }
    } else if (direction === 'up') {
      const prevRowIndex = currentRowIndex - 1;
      if (prevRowIndex >= 0) {
        setEditingCell({ id: visibleInvestors[prevRowIndex].id, field: currentField });
      } else {
        setEditingCell(null);
      }
    }
  }, [visibleInvestors]);

  const toggleSection = (status: Status) => {
    setCollapsedSections(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const getInvestorsByStatus = (status: Status) => investors.filter(inv => inv.status === status);

  // Update local state only (no API call)
  const updateInvestorLocal = (id: string, field: string, value: string | number | null) => {
    setInvestors(prev =>
      prev.map(inv => {
        if (inv.id !== id) return inv;

        // For custom fields mode, update the customFields object
        if (useCustomFields && field !== 'status' && field !== 'name') {
          return {
            ...inv,
            customFields: {
              ...inv.customFields,
              [field]: value,
            },
          };
        }

        // For traditional mode or status/name fields
        return { ...inv, [field]: value };
      })
    );
  };

  // Save to API (called on blur/navigation)
  const saveInvestor = async (id: string, field: string, value: string | number | null) => {
    try {
      // For custom fields mode, save the entire customFields object
      if (useCustomFields && field !== 'status' && field !== 'name') {
        const investor = investors.find(inv => inv.id === id);
        if (!investor) return;

        const updatedCustomFields = {
          ...investor.customFields,
          [field]: value,
        };

        await fetch(`/api/investors/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ custom_fields: updatedCustomFields }),
        });
      } else {
        // For traditional mode or status/name fields
        await fetch(`/api/investors/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: value }),
        });
      }
    } catch (error) {
      console.error('Failed to update investor:', error);
    }
  };

  const addInvestor = async (status: Status) => {
    const tempId = `temp-${Date.now()}`;

    // Create appropriate new investor based on mode
    const newInvestor: InvestorUI = useCustomFields
      ? {
          id: tempId,
          name: '',
          status,
          nextSteps: '',
          notes: '',
          amount: '',
          primaryContact: '',
          firmContact: '',
          fit: null,
          fundSize: '',
          customFields: Object.fromEntries(dynamicColumns.map(col => [col.key, ''])),
        }
      : {
          id: tempId,
          name: '',
          status,
          nextSteps: '',
          notes: '',
          amount: '',
          primaryContact: '',
          firmContact: '',
          fit: null,
          fundSize: '',
          customFields: {},
        };

    setInvestors(prev => [...prev, newInvestor]);

    // Start editing the first editable field
    const firstField = useCustomFields ? dynamicColumns[0]?.key : 'name';
    setEditingCell({ id: tempId, field: firstField });

    try {
      const requestBody = useCustomFields
        ? { name: '', status, custom_fields: newInvestor.customFields }
        : { name: '', status };

      const response = await fetch(`/api/lists/${listId}/investors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        const created = await response.json();
        setInvestors(prev =>
          prev.map(inv => (inv.id === tempId ? toInvestorUI(created) : inv))
        );
        setEditingCell({ id: created.id, field: firstField });
      }
    } catch (error) {
      console.error('Failed to add investor:', error);
      setInvestors(prev => prev.filter(inv => inv.id !== tempId));
      setEditingCell(null);
    }
  };

  const deleteInvestor = async (id: string) => {
    setInvestors(prev => prev.filter(inv => inv.id !== id));

    try {
      await fetch(`/api/investors/${id}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Failed to delete investor:', error);
    }
  };

  const calculateSum = (status: Status) => {
    const amounts = getInvestorsByStatus(status).map(inv => {
      const match = inv.amount.match(/\$?([\d.]+)M?/i);
      return match ? parseFloat(match[1]) : 0;
    });
    const total = amounts.reduce((a, b) => a + b, 0);
    return total > 0 ? `$${total}M` : '—';
  };

  // Column drag and drop handlers
  const handleColumnDragStart = (columnKey: string) => {
    setDraggedColumn(columnKey);
    setDragOverColumn(null);
  };

  const handleColumnDragOver = (e: React.DragEvent, columnKey: string) => {
    e.preventDefault();
    if (draggedColumn === null || draggedColumn === columnKey) return;

    // Determine which half of the column we're hovering over
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    const side = e.clientX < midpoint ? 'left' : 'right';

    setDragOverColumn(columnKey);
    setDropSide(side);
  };

  const handleColumnDrop = (e: React.DragEvent, dropColumnKey: string) => {
    e.preventDefault();
    if (draggedColumn === null || draggedColumn === dropColumnKey) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      setDropSide('left');
      return;
    }

    // Get all current column keys in order
    const allColumnKeys = orderedColumns.map(col => col.key);

    // Build new order by rearranging keys
    const newOrder = [...allColumnKeys];
    const draggedIndex = newOrder.indexOf(draggedColumn);
    let dropIndex = newOrder.indexOf(dropColumnKey);

    if (draggedIndex === -1 || dropIndex === -1) {
      setDraggedColumn(null);
      setDragOverColumn(null);
      return;
    }

    // If dropping on the right side, we want to insert AFTER this column
    if (dropSide === 'right') {
      dropIndex += 1;
    }

    // Remove dragged column from its current position
    const [removed] = newOrder.splice(draggedIndex, 1);

    // Adjust drop index if dragging to the right
    // (after removal, everything shifts left by 1)
    let adjustedDropIndex = dropIndex;
    if (draggedIndex < dropIndex) {
      adjustedDropIndex = dropIndex - 1;
    }

    // Insert it at the adjusted drop position
    newOrder.splice(adjustedDropIndex, 0, removed);

    setColumnOrder(newOrder);
    setDraggedColumn(null);
    setDragOverColumn(null);
    setDropSide('left');

    // Save the new order to the database
    saveColumnOrder(newOrder);
  };

  const handleColumnDragEnd = () => {
    // Use setTimeout to ensure state is reset after the drop event completes
    setTimeout(() => {
      setDraggedColumn(null);
      setDragOverColumn(null);
      setDropSide('left');
    }, 0);
  };

  // Get value for a field from investor (handles both traditional and custom fields)
  const getFieldValue = (investor: InvestorUI, fieldKey: string): string | number | null => {
    if (useCustomFields && fieldKey !== 'status' && fieldKey !== 'name') {
      return investor.customFields?.[fieldKey] ?? '';
    }
    return investor[fieldKey as keyof InvestorUI] as string | number | null;
  };

  // Render a cell based on field type
  const renderCell = (investor: InvestorUI, column: { key: string; label: string; width: number }) => {
    const fieldKey = column.key;
    const value = getFieldValue(investor, fieldKey);
    const isEditing = editingCell?.id === investor.id && editingCell?.field === fieldKey;

    // Status column - always use StatusSelect
    if (fieldKey === 'status') {
      return (
        <td key={fieldKey} style={styles.cell}>
          <StatusSelect
            value={investor.status}
            isEditing={isEditing}
            onStartEdit={() => setEditingCell({ id: investor.id, field: fieldKey })}
            onEndEdit={() => setEditingCell(null)}
            onChange={(val) => {
              updateInvestorLocal(investor.id, fieldKey, val);
              saveInvestor(investor.id, fieldKey, val);
            }}
            onNavigate={(dir) => navigateToCell(investor.id, fieldKey, dir)}
            theme={theme}
            themeColors={colors}
          />
        </td>
      );
    }

    // Fit column in traditional mode - use FitSelect
    if (!useCustomFields && fieldKey === 'fit') {
      return (
        <td key={fieldKey} style={{ ...styles.cell, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
          <FitSelect
            value={investor.fit}
            isEditing={isEditing}
            onStartEdit={() => setEditingCell({ id: investor.id, field: fieldKey })}
            onEndEdit={() => setEditingCell(null)}
            onChange={(val) => {
              updateInvestorLocal(investor.id, fieldKey, val);
              saveInvestor(investor.id, fieldKey, val);
            }}
            onNavigate={(dir) => navigateToCell(investor.id, fieldKey, dir)}
            theme={theme}
            themeColors={colors}
          />
        </td>
      );
    }

    // Regular editable cell
    const cellStyle = fieldKey === 'name'
      ? { ...styles.cell, fontWeight: 500, color: colors.text }
      : { ...styles.cell, color: colors.textSecondary };

    return (
      <td key={fieldKey} style={cellStyle}>
        <EditableCell
          value={String(value || '')}
          isEditing={isEditing}
          onStartEdit={() => setEditingCell({ id: investor.id, field: fieldKey })}
          onEndEdit={() => setEditingCell(null)}
          onChange={(val) => updateInvestorLocal(investor.id, fieldKey, val)}
          onSave={(val) => saveInvestor(investor.id, fieldKey, val)}
          onNavigate={(dir) => navigateToCell(investor.id, fieldKey, dir)}
          placeholder={fieldKey === 'name' ? 'Investor name' : '—'}
          theme={theme}
          themeColors={colors}
        />
      </td>
    );
  };

  // CSV Import Functions
  // Export to CSV function
  const exportToCSV = () => {
    // Get all column keys
    const columnKeys = orderedColumns.map(col => col.key);

    // Create CSV header
    const headers = orderedColumns.map(col => col.label);

    // Create CSV rows
    const rows = investors.map(investor => {
      return columnKeys.map(key => {
        let value: string;

        if (key === 'status') {
          value = investor.status;
        } else if (useCustomFields && key !== 'status') {
          value = String(investor.customFields?.[key] || '');
        } else {
          value = String(investor[key as keyof InvestorUI] || '');
        }

        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          value = '"' + value.replace(/"/g, '""') + '"';
        }

        return value;
      });
    });

    // Combine header and rows
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${listName}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Inject styles via useEffect to avoid hydration mismatch
  useEffect(() => {
    const styleId = 'fundraise-tracker-styles';
    const existingStyle = document.getElementById(styleId);

    // Remove existing style if it exists
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      * { box-sizing: border-box; }

      ::selection {
        background: #6366f1;
        color: white;
      }

      .row { transition: background 0.1s ease; }
      .row:hover { background: ${colors.cellHover}; }
      .row:hover .delete-btn { opacity: 1; }

      .cell-input {
        width: 100%;
        border: none;
        background: ${colors.inputBg};
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px;
        color: ${colors.text};
        padding: 4px 6px;
        margin: -4px -6px;
        outline: none;
        border-radius: 4px;
        box-shadow: 0 0 0 2px ${colors.inputShadow};
      }

      .cell-input::placeholder {
        color: ${colors.placeholder};
      }

      .add-row { transition: background 0.1s ease; }
      .add-row:hover { background: ${colors.cellHover}; }

      .delete-btn {
        opacity: 0;
        transition: opacity 0.15s;
      }

      .section-header {
        transition: background 0.1s ease;
      }

      .section-header:hover {
        background: ${colors.sectionHover};
      }

      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) existingStyle.remove();
    };
  }, [theme, colors]);

  // Don't render until mounted to prevent flash
  if (!mounted) {
    return null;
  }

  return (
    <div suppressHydrationWarning style={{ ...styles.container, background: colors.background }}>
      <header suppressHydrationWarning style={{ ...styles.header, borderBottom: `1px solid ${colors.border}` }}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}></div>
          <div>
            <h1 style={{ ...styles.title, color: colors.text }}>{listName}</h1>
            <p style={{ ...styles.subtitle, color: colors.textTertiary }}>{investors.length} investors tracked</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button
            style={{
              ...styles.themeToggle,
              background: theme === 'dark' ? '#2a2a3a' : '#e5e7eb',
            }}
            onClick={toggleTheme}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          >
            <div style={{
              ...styles.toggleTrack,
            }}>
              <div style={{
                ...styles.toggleThumb,
                transform: theme === 'dark' ? 'translateX(0)' : 'translateX(20px)',
                background: theme === 'dark' ? '#6366f1' : '#f59e0b',
              }}>
                {theme === 'dark' ? (
                  <Moon size={12} color="white" strokeWidth={2} />
                ) : (
                  <Sun size={12} color="rgba(255, 255, 255, 0.9)" strokeWidth={2} />
                )}
              </div>
            </div>
          </button>
          <button
            style={styles.exportButton}
            onClick={exportToCSV}
          >
            Export CSV
          </button>
        </div>
      </header>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 36, color: colors.textTertiary, borderBottom: `1px solid ${colors.border}` }}></th>
              {orderedColumns.map((col, index) => (
                  <th
                    key={col.key}
                    draggable={editingColumnKey !== col.key}
                    onDragStart={() => handleColumnDragStart(col.key)}
                    onDragOver={(e) => handleColumnDragOver(e, col.key)}
                    onDrop={(e) => handleColumnDrop(e, col.key)}
                    onDragEnd={handleColumnDragEnd}
                    onDoubleClick={() => {
                      if (useCustomFields && col.key !== 'status') {
                        setEditingColumnKey(col.key);
                        setEditingColumnValue(col.label);
                      }
                    }}
                    style={{
                      ...styles.th,
                      width: col.width,
                      cursor: editingColumnKey === col.key ? 'text' : (draggedColumn === col.key ? 'grabbing' : 'grab'),
                      opacity: draggedColumn === col.key ? 0.5 : 1,
                      transition: 'all 0.15s ease',
                      color: colors.textTertiary,
                      borderBottom: `1px solid ${colors.border}`,
                      borderLeft: dragOverColumn === col.key && draggedColumn !== null && draggedColumn !== col.key && dropSide === 'left' ?
                        `3px solid ${theme === 'dark' ? '#6366f1' : '#8b5cf6'}` :
                        '3px solid transparent',
                      borderRight: dragOverColumn === col.key && draggedColumn !== null && draggedColumn !== col.key && dropSide === 'right' ?
                        `3px solid ${theme === 'dark' ? '#6366f1' : '#8b5cf6'}` :
                        '3px solid transparent',
                      position: 'relative' as const,
                    }}
                  >
                  {editingColumnKey === col.key ? (
                    <input
                      type="text"
                      value={editingColumnValue}
                      onChange={(e) => setEditingColumnValue(e.target.value)}
                      onBlur={() => {
                        renameColumn(col.key, editingColumnValue);
                        setEditingColumnKey(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          renameColumn(col.key, editingColumnValue);
                          setEditingColumnKey(null);
                        } else if (e.key === 'Escape') {
                          setEditingColumnKey(null);
                        }
                      }}
                      autoFocus
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: colors.textTertiary,
                        fontSize: '11px',
                        fontFamily: "'JetBrains Mono', monospace",
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        outline: 'none',
                        width: '100%',
                      }}
                    />
                  ) : (
                    col.label
                  )}
                  </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {STATUSES.map(status => {
              const statusInvestors = getInvestorsByStatus(status);
              const isCollapsed = collapsedSections[status];
              const statusColors = STATUS_COLORS[status];

              return (
                <React.Fragment key={status}>
                  <tr
                    className="section-header"
                    style={styles.sectionHeader}
                    onClick={() => toggleSection(status)}
                  >
                    <td colSpan={orderedColumns.length + 1} style={{ ...styles.sectionHeaderCell, borderBottom: `1px solid ${colors.border}` }}>
                      <div style={styles.sectionHeaderContent}>
                        <div style={styles.sectionLeft}>
                          <span
                            style={{
                              ...styles.chevron,
                              color: colors.textTertiary,
                              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            }}
                          >
                            ▾
                          </span>
                          <span style={{ ...styles.statusIndicator, background: statusColors.border }}></span>
                          <span style={{ ...styles.sectionTitle, color: statusColors.text }}>{status}</span>
                          <span style={{ ...styles.sectionCount, color: colors.placeholder }}>{statusInvestors.length}</span>
                        </div>
                        <div style={styles.sectionRight}>
                          <span style={{ ...styles.sumValue, color: colors.textTertiary }}>{calculateSum(status)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>

                  {!isCollapsed &&
                    statusInvestors.map((investor, idx) => (
                      <tr
                        key={investor.id}
                        className="row"
                        style={{
                          ...styles.row,
                          borderBottom: `1px solid ${colors.borderLight}`,
                          animation: `fadeIn 0.2s ease ${idx * 0.02}s both`,
                        }}
                      >
                        <td style={styles.cellAction}>
                          <button
                            className="delete-btn"
                            style={styles.deleteButton}
                            onClick={() => deleteInvestor(investor.id)}
                          >
                            ×
                          </button>
                        </td>
                        {orderedColumns.map(col => renderCell(investor, col))}
                      </tr>
                    ))}

                  {!isCollapsed && (
                    <tr className="add-row" style={{ ...styles.addRow, borderBottom: `1px solid ${colors.border}` }} onClick={() => addInvestor(status)}>
                      <td style={styles.cellAction}></td>
                      <td colSpan={orderedColumns.length} style={styles.addRowCell}>
                        <span style={{ ...styles.addText, color: colors.placeholder }}>+ Add investor</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ ...styles.footer, background: colors.background, borderTop: `1px solid ${colors.border}` }}>
        <span style={{ ...styles.hint, color: colors.placeholder }}>Tab → next cell</span>
        <span style={{ ...styles.hint, color: colors.placeholder }}>Enter ↓ next row</span>
        <span style={{ ...styles.hint, color: colors.placeholder }}>Shift reverses direction</span>
      </div>

    </div>
  );
}

interface EditableCellProps {
  value: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: (value: string) => void;
  onSave: (value: string) => void;
  onNavigate: (direction: string) => void;
  placeholder: string;
  theme: Theme;
  themeColors: ThemeColors;
}

function EditableCell({ value, isEditing, onStartEdit, onEndEdit, onChange, onSave, onNavigate, placeholder, theme, themeColors }: EditableCellProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);

  // Keep valueRef in sync for saving on navigation
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      onSave(valueRef.current);
      if (e.shiftKey) {
        onNavigate('left');
      } else {
        onNavigate('right');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onSave(valueRef.current);
      if (e.shiftKey) {
        onNavigate('up');
      } else {
        onNavigate('down');
      }
    } else if (e.key === 'Escape') {
      onEndEdit();
    }
  };

  const handleBlur = () => {
    onSave(valueRef.current);
    onEndEdit();
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
        placeholder={placeholder}
      />
    );
  }

  return (
    <div
      onClick={onStartEdit}
      style={{
        minHeight: '20px',
        cursor: 'text',
        color: value ? 'inherit' : themeColors.placeholder,
      }}
    >
      {value || placeholder}
    </div>
  );
}

interface StatusSelectProps {
  value: Status;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: (value: string) => void;
  onNavigate: (direction: string) => void;
  theme: Theme;
  themeColors: ThemeColors;
}

function StatusSelect({ value, isEditing, onStartEdit, onEndEdit, onChange, onNavigate, theme, themeColors }: StatusSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(STATUSES.indexOf(value));
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const isNavigatingRef = useRef(false);
  const statusColors = STATUS_COLORS[value];

  useEffect(() => {
    if (isEditing && dropdownRef.current) {
      dropdownRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
      // Reset highlighted index to current value when dropdown opens
      setHighlightedIndex(STATUSES.indexOf(value));
    }
  }, [isOpen, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!isNavigatingRef.current) {
          onEndEdit();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onEndEdit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      isNavigatingRef.current = true;
      setIsOpen(false);
      if (e.shiftKey) {
        onNavigate('left');
      } else {
        onNavigate('right');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        // Select the highlighted option
        onChange(STATUSES[highlightedIndex]);
        setIsOpen(false);
      } else {
        isNavigatingRef.current = true;
        setIsOpen(false);
        if (e.shiftKey) {
          onNavigate('up');
        } else {
          onNavigate('down');
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      onEndEdit();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        // Just update highlighted index, don't change the value yet
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(highlightedIndex + 1, STATUSES.length - 1)
          : Math.max(highlightedIndex - 1, 0);
        setHighlightedIndex(nextIndex);
      }
    }
  };

  const handleSelect = (status: Status) => {
    onChange(status);
    setIsOpen(false);
    isNavigatingRef.current = false;
  };

  const dropdownMenu = isOpen && position && typeof window !== 'undefined' ? createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999998,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(false);
        }}
      />
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          background: theme === 'dark' ? '#12121a' : '#ffffff',
          border: `1px solid ${themeColors.border}`,
          borderRadius: '6px',
          boxShadow: theme === 'dark' ? '0 8px 24px rgba(0, 0, 0, 0.8)' : '0 8px 24px rgba(0, 0, 0, 0.3)',
          zIndex: 999999,
          minWidth: '160px',
          overflow: 'hidden',
        }}
      >
        {STATUSES.map((status, index) => {
          const colors = STATUS_COLORS[status];
          const isHighlighted = index === highlightedIndex;
          return (
            <div
              key={status}
              onClick={() => handleSelect(status)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 12px',
                cursor: 'pointer',
                background: isHighlighted ? themeColors.cellHover : 'transparent',
                transition: 'background 0.1s ease',
              }}
            >
              <span
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: colors.border,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: colors.text,
                  fontWeight: 500,
                }}
              >
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={buttonRef}
        tabIndex={0}
        style={{
          position: 'relative',
          outline: 'none',
        }}
        onFocus={onStartEdit}
        onKeyDown={handleKeyDown}
      >
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            background: isEditing ? themeColors.inputBg : 'transparent',
            border: '1px solid transparent',
            transition: 'all 0.15s ease',
            boxShadow: isEditing ? `0 0 0 2px ${themeColors.inputShadow}` : 'none',
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: statusColors.border,
            }}
          />
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: statusColors.text,
              fontWeight: 500,
            }}
          >
            {value}
          </span>
        </div>
      </div>
      {dropdownMenu}
    </>
  );
}

const FIT_OPTIONS = [null, 1, 2, 3, 4, 5] as const;
const FIT_COLORS: Record<number, string> = {
  1: '#ef4444', // red - poor fit
  2: '#f97316', // orange
  3: '#eab308', // yellow
  4: '#22c55e', // green
  5: '#10b981', // emerald - great fit
};

interface FitSelectProps {
  value: number | null;
  isEditing: boolean;
  onStartEdit: () => void;
  onEndEdit: () => void;
  onChange: (value: number | null) => void;
  onNavigate: (direction: string) => void;
  theme: Theme;
  themeColors: ThemeColors;
}

function FitSelect({ value, isEditing, onStartEdit, onEndEdit, onChange, onNavigate, theme, themeColors }: FitSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(() => {
    const index = FIT_OPTIONS.indexOf(value);
    return index === -1 ? 0 : index;
  });
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (isEditing && dropdownRef.current) {
      dropdownRef.current.focus();
    }
  }, [isEditing]);

  useEffect(() => {
    if (isOpen && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 4,
        left: rect.left
      });
      // Reset highlighted index to current value when dropdown opens
      const index = FIT_OPTIONS.indexOf(value);
      setHighlightedIndex(index === -1 ? 0 : index);
    }
  }, [isOpen, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (!isNavigatingRef.current) {
          onEndEdit();
        }
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onEndEdit]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      isNavigatingRef.current = true;
      setIsOpen(false);
      if (e.shiftKey) {
        onNavigate('left');
      } else {
        onNavigate('right');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (isOpen) {
        // Select the highlighted option
        onChange(FIT_OPTIONS[highlightedIndex]);
        setIsOpen(false);
      } else {
        isNavigatingRef.current = true;
        setIsOpen(false);
        if (e.shiftKey) {
          onNavigate('up');
        } else {
          onNavigate('down');
        }
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      onEndEdit();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
      } else {
        // Just update highlighted index, don't change the value yet
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(highlightedIndex + 1, FIT_OPTIONS.length - 1)
          : Math.max(highlightedIndex - 1, 0);
        setHighlightedIndex(nextIndex);
      }
    }
  };

  const handleSelect = (fitValue: number | null) => {
    onChange(fitValue);
    setIsOpen(false);
    isNavigatingRef.current = false;
  };

  const color = value !== null ? FIT_COLORS[value] : themeColors.textTertiary;

  const dropdownMenu = isOpen && position && typeof window !== 'undefined' ? createPortal(
    <>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 999998,
        }}
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(false);
        }}
      />
      <div
        ref={dropdownRef}
        style={{
          position: 'fixed',
          top: `${position.top}px`,
          left: `${position.left}px`,
          background: theme === 'dark' ? '#12121a' : '#ffffff',
          border: `1px solid ${themeColors.border}`,
          borderRadius: '6px',
          boxShadow: theme === 'dark' ? '0 8px 24px rgba(0, 0, 0, 0.8)' : '0 8px 24px rgba(0, 0, 0, 0.3)',
          zIndex: 999999,
          minWidth: '80px',
          overflow: 'hidden',
        }}
      >
        {FIT_OPTIONS.map((fitValue, index) => {
          const optionColor = fitValue !== null ? FIT_COLORS[fitValue] : themeColors.textTertiary;
          const isHighlighted = index === highlightedIndex;
          return (
            <div
              key={fitValue ?? 'null'}
              onClick={() => handleSelect(fitValue)}
              onMouseEnter={() => setHighlightedIndex(index)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 12px',
                cursor: 'pointer',
                background: isHighlighted ? themeColors.cellHover : 'transparent',
                transition: 'background 0.1s ease',
              }}
            >
              <span
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '11px',
                  color: optionColor,
                  fontWeight: 500,
                }}
              >
                {fitValue ?? '—'}
              </span>
            </div>
          );
        })}
      </div>
    </>,
    document.body
  ) : null;

  return (
    <>
      <div
        ref={buttonRef}
        tabIndex={0}
        style={{
          position: 'relative',
          outline: 'none',
        }}
        onFocus={onStartEdit}
        onKeyDown={handleKeyDown}
      >
        <div
          onClick={() => setIsOpen(!isOpen)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '4px 8px',
            borderRadius: '4px',
            cursor: 'pointer',
            background: isEditing ? themeColors.inputBg : 'transparent',
            border: '1px solid transparent',
            transition: 'all 0.15s ease',
            boxShadow: isEditing ? `0 0 0 2px ${themeColors.inputShadow}` : 'none',
            minWidth: '40px',
          }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '11px',
              color: color,
              fontWeight: 500,
            }}
          >
            {value ?? '—'}
          </span>
        </div>
      </div>
      {dropdownMenu}
    </>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    fontFamily: "'Space Grotesk', sans-serif",
    color: '#a0a0b0',
    fontSize: '13px',
  },
  header: {
    padding: '24px 32px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #1a1a2a',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  logoMark: {
    width: '32px',
    height: '32px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    borderRadius: '8px',
  },
  title: {
    fontSize: '18px',
    fontWeight: '600',
    margin: '0 0 2px 0',
    color: '#ffffff',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '12px',
    color: '#5a5a6a',
    margin: 0,
  },
  stats: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
  },
  stat: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '6px',
  },
  statValue: {
    fontSize: '24px',
    fontWeight: '600',
    fontFamily: "'JetBrains Mono', monospace",
    color: '#ffffff',
  },
  statLabel: {
    fontSize: '12px',
    color: '#5a5a6a',
  },
  statDivider: {
    width: '1px',
    height: '24px',
    background: '#2a2a3a',
  },
  tableContainer: {
    overflowX: 'auto',
    padding: '0 16px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: '900px',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontWeight: '500',
    color: '#5a5a6a',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '1px solid #1a1a2a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  sectionHeader: {
    cursor: 'pointer',
  },
  sectionHeaderCell: {
    padding: '0',
    borderBottom: '1px solid #1a1a2a',
  },
  sectionHeaderContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '14px 16px',
  },
  sectionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  chevron: {
    fontSize: '10px',
    color: '#5a5a6a',
    transition: 'transform 0.15s ease',
  },
  statusIndicator: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
  },
  sectionCount: {
    fontSize: '12px',
    color: '#4a4a5a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  sectionRight: {
    display: 'flex',
    alignItems: 'center',
  },
  sumValue: {
    fontSize: '12px',
    color: '#5a5a6a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  row: {
    borderBottom: '1px solid #151520',
  },
  cell: {
    padding: '12px 16px',
    verticalAlign: 'middle',
  },
  cellAction: {
    padding: '12px 8px',
    width: '36px',
    textAlign: 'center',
  },
  deleteButton: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    fontSize: '16px',
    cursor: 'pointer',
    padding: '0',
    lineHeight: 1,
    opacity: 0.8,
  },
  addRow: {
    cursor: 'pointer',
    borderBottom: '1px solid #1a1a2a',
  },
  addRowCell: {
    padding: '10px 16px',
  },
  addText: {
    color: '#3a3a4a',
    fontSize: '12px',
  },
  footer: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    padding: '12px 32px',
    background: '#0a0a0f',
    borderTop: '1px solid #1a1a2a',
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
  },
  hint: {
    fontSize: '11px',
    color: '#4a4a5a',
    fontFamily: "'JetBrains Mono', monospace",
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  themeToggle: {
    padding: '4px',
    borderRadius: '14px',
    cursor: 'pointer',
    border: 'none',
    transition: 'background 0.3s ease',
    display: 'flex',
    alignItems: 'center',
  },
  toggleTrack: {
    width: '40px',
    height: '20px',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  toggleThumb: {
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    transition: 'transform 0.3s ease, background 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
  importButton: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid #6366f1',
    color: '#818cf8',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    transition: 'all 0.15s ease',
  },
  exportButton: {
    background: 'rgba(99, 102, 241, 0.15)',
    border: '1px solid #6366f1',
    color: '#818cf8',
    padding: '8px 16px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
    transition: 'all 0.15s ease',
  },
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0, 0, 0, 0.8)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#0f0f18',
    borderRadius: '12px',
    border: '1px solid #2a2a3a',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '80vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid #1a1a2a',
  },
  modalTitle: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#ffffff',
    margin: 0,
  },
  modalClose: {
    background: 'none',
    border: 'none',
    color: '#5a5a6a',
    fontSize: '24px',
    cursor: 'pointer',
    padding: 0,
    lineHeight: 1,
  },
  dropZone: {
    margin: '24px',
    padding: '48px',
    border: '2px dashed #2a2a3a',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
  },
  dropIcon: {
    fontSize: '48px',
  },
  dropText: {
    color: '#a0a0b0',
    fontSize: '14px',
    margin: 0,
  },
  dropSubtext: {
    color: '#5a5a6a',
    fontSize: '12px',
    margin: 0,
  },
  fileInputLabel: {
    background: '#6366f1',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  mappingContainer: {
    padding: '24px',
  },
  mappingInfo: {
    color: '#a0a0b0',
    fontSize: '13px',
    margin: '0 0 20px 0',
  },
  mappingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  mappingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  csvColumnName: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: '13px',
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '8px 12px',
    borderRadius: '4px',
  },
  mappingArrow: {
    color: '#5a5a6a',
    fontSize: '14px',
  },
  mappingSelect: {
    flex: 1,
    background: '#1a1a2e',
    border: '1px solid #2a2a3a',
    color: '#e0e0e0',
    padding: '8px 12px',
    borderRadius: '4px',
    fontSize: '13px',
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: 'pointer',
  },
  previewContainer: {
    marginTop: '24px',
    padding: '16px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '8px',
  },
  previewTitle: {
    color: '#5a5a6a',
    fontSize: '11px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 12px 0',
  },
  previewTable: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  previewRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
    padding: '8px',
    background: 'rgba(255, 255, 255, 0.02)',
    borderRadius: '4px',
  },
  previewCell: {
    display: 'flex',
    gap: '4px',
    fontSize: '12px',
  },
  previewLabel: {
    color: '#5a5a6a',
  },
  previewValue: {
    color: '#e0e0e0',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    justifyContent: 'flex-end',
  },
  cancelButton: {
    background: 'transparent',
    border: '1px solid #2a2a3a',
    color: '#a0a0b0',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  importActionButton: {
    background: '#6366f1',
    border: 'none',
    color: '#ffffff',
    padding: '10px 20px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  warningText: {
    color: '#f97316',
    fontSize: '12px',
    marginTop: '12px',
    textAlign: 'center',
  },
};
