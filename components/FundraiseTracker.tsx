'use client';

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { Investor, InvestorUI, Status } from '@/lib/types';
import { toInvestorUI } from '@/lib/types';

const STATUSES: Status[] = ['Lead', 'First Meeting', 'Partner Meeting', 'Term Sheet', 'Passed'];
const FIELDS = ['name', 'status', 'fit', 'fundSize', 'nextSteps', 'notes', 'amount', 'primaryContact', 'firmContact'];

// Column mapping configuration for CSV import
const COLUMN_CONFIG = [
  { key: 'name', label: 'Investor Name', aliases: ['investor', 'firm', 'vc', 'fund', 'company', 'firm name', 'fund name', 'vc name'] },
  { key: 'status', label: 'Status', aliases: ['stage', 'pipeline', 'progress'] },
  { key: 'fit', label: 'Fit (1-5)', aliases: ['rating', 'score', 'priority', 'tier'] },
  { key: 'fundSize', label: 'Fund Size', aliases: ['fund size', 'aum', 'assets', 'capital'] },
  { key: 'nextSteps', label: 'Next Steps', aliases: ['next steps', 'next step', 'action', 'todo', 'follow up', 'followup'] },
  { key: 'notes', label: 'Notes', aliases: ['note', 'comments', 'comment', 'description'] },
  { key: 'amount', label: 'Amount', aliases: ['check size', 'investment', 'commitment', 'allocation'] },
  { key: 'primaryContact', label: 'VC Contact', aliases: ['vc contact', 'contact', 'partner', 'gp', 'lead'] },
  { key: 'firmContact', label: 'Our Contact', aliases: ['our contact', 'internal', 'team', 'owner', 'assigned'] },
];

const STATUS_COLORS: Record<Status, { bg: string; text: string; border: string }> = {
  'Lead': { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: '#6366f1' },
  'First Meeting': { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: '#22c55e' },
  'Partner Meeting': { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: '#eab308' },
  'Term Sheet': { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: '#06b6d4' },
  'Passed': { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: '#ef4444' },
};

interface FundraiseTrackerProps {
  listId: string;
  listName: string;
  initialInvestors: Investor[];
}

// CSV import types
interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  appColumn: string | null;
}

export default function FundraiseTracker({ listId, listName, initialInvestors }: FundraiseTrackerProps) {
  const [investors, setInvestors] = useState<InvestorUI[]>(() =>
    initialInvestors.map(toInvestorUI)
  );
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);

  // CSV import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');

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
      prev.map(inv => (inv.id === id ? { ...inv, [field]: value } : inv))
    );
  };

  // Save to API (called on blur/navigation)
  const saveInvestor = async (id: string, field: string, value: string | number | null) => {
    try {
      await fetch(`/api/investors/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch (error) {
      console.error('Failed to update investor:', error);
    }
  };

  const addInvestor = async (status: Status) => {
    const tempId = `temp-${Date.now()}`;
    const newInvestor: InvestorUI = {
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
    };

    setInvestors(prev => [...prev, newInvestor]);
    setEditingCell({ id: tempId, field: 'name' });

    try {
      const response = await fetch(`/api/lists/${listId}/investors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', status }),
      });

      if (response.ok) {
        const created = await response.json();
        setInvestors(prev =>
          prev.map(inv => (inv.id === tempId ? toInvestorUI(created) : inv))
        );
        setEditingCell({ id: created.id, field: 'name' });
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

  // CSV Import Functions
  const fuzzyMatch = (csvCol: string, appCol: { key: string; label: string; aliases: string[] }): number => {
    const normalizedCsv = csvCol.toLowerCase().trim();
    const normalizedKey = appCol.key.toLowerCase();
    const normalizedLabel = appCol.label.toLowerCase();

    // Exact match with key or label
    if (normalizedCsv === normalizedKey || normalizedCsv === normalizedLabel) return 100;

    // Exact match with alias
    if (appCol.aliases.some(a => normalizedCsv === a.toLowerCase())) return 95;

    // Contains key or label
    if (normalizedCsv.includes(normalizedKey) || normalizedKey.includes(normalizedCsv)) return 80;
    if (normalizedCsv.includes(normalizedLabel) || normalizedLabel.includes(normalizedCsv)) return 75;

    // Contains alias
    if (appCol.aliases.some(a => normalizedCsv.includes(a.toLowerCase()) || a.toLowerCase().includes(normalizedCsv))) return 70;

    return 0;
  };

  const findBestMatch = (csvColumn: string): string | null => {
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const config of COLUMN_CONFIG) {
      const score = fuzzyMatch(csvColumn, config);
      if (score > bestScore && score >= 70) {
        bestScore = score;
        bestMatch = config.key;
      }
    }

    return bestMatch;
  };

  const parseCSV = (text: string): { columns: string[]; rows: CsvRow[] } => {
    const lines = text.split(/\r?\n/).filter(line => line.trim());
    if (lines.length === 0) return { columns: [], rows: [] };

    // Parse header
    const columns = lines[0].split(',').map(col => col.trim().replace(/^"|"$/g, ''));

    // Parse rows
    const rows: CsvRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(val => val.trim().replace(/^"|"$/g, ''));
      const row: CsvRow = {};
      columns.forEach((col, idx) => {
        row[col] = values[idx] || '';
      });
      if (Object.values(row).some(v => v)) {
        rows.push(row);
      }
    }

    return { columns, rows };
  };

  const handleFileUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { columns, rows } = parseCSV(text);

      setCsvColumns(columns);
      setCsvData(rows);

      // Auto-map columns using fuzzy matching
      const mappings: ColumnMapping[] = columns.map(col => ({
        csvColumn: col,
        appColumn: findBestMatch(col),
      }));
      setColumnMappings(mappings);
      setImportStatus('idle');
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const updateMapping = (csvColumn: string, appColumn: string | null) => {
    setColumnMappings(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, appColumn } : m))
    );
  };

  const executeImport = async () => {
    setImportStatus('importing');

    try {
      const importedInvestors: Partial<InvestorUI>[] = csvData.map(row => {
        const investor: Partial<InvestorUI> = {
          status: 'Lead' as Status,
        };

        columnMappings.forEach(mapping => {
          if (mapping.appColumn && row[mapping.csvColumn]) {
            const value = row[mapping.csvColumn];

            if (mapping.appColumn === 'fit') {
              const num = parseInt(value, 10);
              if (num >= 1 && num <= 5) {
                investor.fit = num;
              }
            } else if (mapping.appColumn === 'status') {
              // Try to match status value
              const matchedStatus = STATUSES.find(s =>
                s.toLowerCase() === value.toLowerCase() ||
                s.toLowerCase().includes(value.toLowerCase()) ||
                value.toLowerCase().includes(s.toLowerCase())
              );
              if (matchedStatus) {
                investor.status = matchedStatus;
              }
            } else {
              (investor as any)[mapping.appColumn] = value;
            }
          }
        });

        return investor;
      });

      // Create investors via API
      for (const inv of importedInvestors) {
        if (inv.name) {
          const response = await fetch(`/api/lists/${listId}/investors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(inv),
          });

          if (response.ok) {
            const created = await response.json();
            setInvestors(prev => [...prev, toInvestorUI(created)]);
          }
        }
      }

      setImportStatus('success');
      setTimeout(() => {
        setShowImportModal(false);
        setCsvData([]);
        setCsvColumns([]);
        setColumnMappings([]);
        setImportStatus('idle');
      }, 1500);
    } catch (error) {
      console.error('Import failed:', error);
      setImportStatus('error');
    }
  };

  const totalActive = investors.filter(i => i.status !== 'Passed').length;
  const totalTermSheets = getInvestorsByStatus('Term Sheet').length;

  // Inject styles via useEffect to avoid hydration mismatch
  useEffect(() => {
    const styleId = 'fundraise-tracker-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      * { box-sizing: border-box; }

      ::selection {
        background: #6366f1;
        color: white;
      }

      .row { transition: background 0.1s ease; }
      .row:hover { background: rgba(255,255,255,0.02); }
      .row:hover .delete-btn { opacity: 1; }

      .cell-input {
        width: 100%;
        border: none;
        background: rgba(99, 102, 241, 0.1);
        font-family: 'Space Grotesk', sans-serif;
        font-size: 13px;
        color: #e0e0e0;
        padding: 4px 6px;
        margin: -4px -6px;
        outline: none;
        border-radius: 4px;
        box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
      }

      .cell-input::placeholder {
        color: #4a4a5a;
      }

      .add-row { transition: background 0.1s ease; }
      .add-row:hover { background: rgba(255,255,255,0.02); }

      .status-select {
        appearance: none;
        border: 1px solid transparent;
        background: transparent;
        font-family: 'JetBrains Mono', monospace;
        font-size: 11px;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        outline: none;
        transition: all 0.15s ease;
      }

      .status-select:hover {
        border-color: currentColor;
      }

      .status-select option {
        background: #1a1a2e;
        color: #e0e0e0;
      }

      .delete-btn {
        opacity: 0;
        transition: opacity 0.15s;
      }

      .section-header {
        transition: background 0.1s ease;
      }

      .section-header:hover {
        background: rgba(255,255,255,0.03);
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
  }, []);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}></div>
          <div>
            <h1 style={styles.title}>{listName}</h1>
            <p style={styles.subtitle}>{investors.length} investors tracked</p>
          </div>
        </div>
        <div style={styles.headerRight}>
          <button
            style={styles.importButton}
            onClick={() => setShowImportModal(true)}
          >
            Import CSV
          </button>
          <div style={styles.stats}>
            <div style={styles.stat}>
              <span style={styles.statValue}>{totalActive}</span>
              <span style={styles.statLabel}>active</span>
            </div>
            <div style={styles.statDivider}></div>
            <div style={styles.stat}>
              <span style={{ ...styles.statValue, color: '#22d3ee' }}>{totalTermSheets}</span>
              <span style={styles.statLabel}>term sheets</span>
            </div>
          </div>
        </div>
      </header>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 36 }}></th>
              <th style={{ ...styles.th, width: 180 }}>Investor</th>
              <th style={{ ...styles.th, width: 120 }}>Status</th>
              <th style={{ ...styles.th, width: 50 }}>Fit</th>
              <th style={{ ...styles.th, width: 100 }}>Fund Size</th>
              <th style={{ ...styles.th, width: 180 }}>Next Steps</th>
              <th style={{ ...styles.th, width: 200 }}>Notes</th>
              <th style={{ ...styles.th, width: 80 }}>Amount</th>
              <th style={{ ...styles.th, width: 120 }}>VC Contact</th>
              <th style={{ ...styles.th, width: 100 }}>Our Contact</th>
            </tr>
          </thead>
          <tbody>
            {STATUSES.map(status => {
              const statusInvestors = getInvestorsByStatus(status);
              const isCollapsed = collapsedSections[status];
              const colors = STATUS_COLORS[status];

              return (
                <React.Fragment key={status}>
                  <tr
                    className="section-header"
                    style={styles.sectionHeader}
                    onClick={() => toggleSection(status)}
                  >
                    <td colSpan={10} style={styles.sectionHeaderCell}>
                      <div style={styles.sectionHeaderContent}>
                        <div style={styles.sectionLeft}>
                          <span
                            style={{
                              ...styles.chevron,
                              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                            }}
                          >
                            ▾
                          </span>
                          <span style={{ ...styles.statusIndicator, background: colors.border }}></span>
                          <span style={{ ...styles.sectionTitle, color: colors.text }}>{status}</span>
                          <span style={styles.sectionCount}>{statusInvestors.length}</span>
                        </div>
                        <div style={styles.sectionRight}>
                          <span style={styles.sumValue}>{calculateSum(status)}</span>
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
                        <td style={{ ...styles.cell, fontWeight: 500, color: '#fff' }}>
                          <EditableCell
                            value={investor.name}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'name'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'name' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'name', val)}
                            onSave={(val) => saveInvestor(investor.id, 'name', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'name', dir)}
                            placeholder="Investor name"
                          />
                        </td>
                        <td style={styles.cell}>
                          <StatusSelect
                            value={investor.status}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'status'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'status' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => {
                              updateInvestorLocal(investor.id, 'status', val);
                              saveInvestor(investor.id, 'status', val);
                            }}
                            onNavigate={(dir) => navigateToCell(investor.id, 'status', dir)}
                          />
                        </td>
                        <td style={{ ...styles.cell, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                          <FitSelect
                            value={investor.fit}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'fit'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'fit' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => {
                              updateInvestorLocal(investor.id, 'fit', val);
                              saveInvestor(investor.id, 'fit', val);
                            }}
                            onNavigate={(dir) => navigateToCell(investor.id, 'fit', dir)}
                          />
                        </td>
                        <td style={{ ...styles.cell, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                          <EditableCell
                            value={investor.fundSize}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'fundSize'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'fundSize' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'fundSize', val)}
                            onSave={(val) => saveInvestor(investor.id, 'fundSize', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'fundSize', dir)}
                            placeholder="—"
                          />
                        </td>
                        <td style={styles.cell}>
                          <EditableCell
                            value={investor.nextSteps}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'nextSteps'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'nextSteps' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'nextSteps', val)}
                            onSave={(val) => saveInvestor(investor.id, 'nextSteps', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'nextSteps', dir)}
                            placeholder="—"
                          />
                        </td>
                        <td style={styles.cell}>
                          <EditableCell
                            value={investor.notes}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'notes'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'notes' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'notes', val)}
                            onSave={(val) => saveInvestor(investor.id, 'notes', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'notes', dir)}
                            placeholder="—"
                          />
                        </td>
                        <td style={{ ...styles.cell, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px' }}>
                          <EditableCell
                            value={investor.amount}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'amount'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'amount' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'amount', val)}
                            onSave={(val) => saveInvestor(investor.id, 'amount', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'amount', dir)}
                            placeholder="—"
                          />
                        </td>
                        <td style={styles.cell}>
                          <EditableCell
                            value={investor.primaryContact}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'primaryContact'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'primaryContact' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'primaryContact', val)}
                            onSave={(val) => saveInvestor(investor.id, 'primaryContact', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'primaryContact', dir)}
                            placeholder="—"
                          />
                        </td>
                        <td style={styles.cell}>
                          <EditableCell
                            value={investor.firmContact}
                            isEditing={editingCell?.id === investor.id && editingCell?.field === 'firmContact'}
                            onStartEdit={() => setEditingCell({ id: investor.id, field: 'firmContact' })}
                            onEndEdit={() => setEditingCell(null)}
                            onChange={(val) => updateInvestorLocal(investor.id, 'firmContact', val)}
                            onSave={(val) => saveInvestor(investor.id, 'firmContact', val)}
                            onNavigate={(dir) => navigateToCell(investor.id, 'firmContact', dir)}
                            placeholder="—"
                          />
                        </td>
                      </tr>
                    ))}

                  {!isCollapsed && (
                    <tr className="add-row" style={styles.addRow} onClick={() => addInvestor(status)}>
                      <td style={styles.cellAction}></td>
                      <td colSpan={9} style={styles.addRowCell}>
                        <span style={styles.addText}>+ Add investor</span>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={styles.footer}>
        <span style={styles.hint}>Tab → next cell</span>
        <span style={styles.hint}>Enter ↓ next row</span>
        <span style={styles.hint}>Shift reverses direction</span>
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div style={styles.modalOverlay} onClick={() => setShowImportModal(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>Import from CSV</h2>
              <button
                style={styles.modalClose}
                onClick={() => {
                  setShowImportModal(false);
                  setCsvData([]);
                  setCsvColumns([]);
                  setColumnMappings([]);
                }}
              >
                ×
              </button>
            </div>

            {csvColumns.length === 0 ? (
              <div
                style={{
                  ...styles.dropZone,
                  borderColor: isDragging ? '#6366f1' : '#2a2a3a',
                  background: isDragging ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div style={styles.dropZoneContent}>
                  <div style={styles.dropIcon}>📄</div>
                  <p style={styles.dropText}>Drag and drop a CSV file here</p>
                  <p style={styles.dropSubtext}>or</p>
                  <label style={styles.fileInputLabel}>
                    Browse files
                    <input
                      type="file"
                      accept=".csv"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(file);
                      }}
                    />
                  </label>
                </div>
              </div>
            ) : (
              <div style={styles.mappingContainer}>
                <p style={styles.mappingInfo}>
                  Found {csvData.length} rows with {csvColumns.length} columns.
                  Map your CSV columns to the app fields:
                </p>

                <div style={styles.mappingList}>
                  {columnMappings.map((mapping) => (
                    <div key={mapping.csvColumn} style={styles.mappingRow}>
                      <div style={styles.csvColumnName}>{mapping.csvColumn}</div>
                      <div style={styles.mappingArrow}>→</div>
                      <select
                        style={styles.mappingSelect}
                        value={mapping.appColumn || ''}
                        onChange={(e) => updateMapping(mapping.csvColumn, e.target.value || null)}
                      >
                        <option value="">Don't import</option>
                        {COLUMN_CONFIG.map((col) => (
                          <option key={col.key} value={col.key}>
                            {col.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>

                {csvData.length > 0 && (
                  <div style={styles.previewContainer}>
                    <p style={styles.previewTitle}>Preview (first 3 rows):</p>
                    <div style={styles.previewTable}>
                      {csvData.slice(0, 3).map((row, idx) => (
                        <div key={idx} style={styles.previewRow}>
                          {columnMappings
                            .filter((m) => m.appColumn)
                            .map((m) => (
                              <div key={m.csvColumn} style={styles.previewCell}>
                                <span style={styles.previewLabel}>
                                  {COLUMN_CONFIG.find((c) => c.key === m.appColumn)?.label}:
                                </span>
                                <span style={styles.previewValue}>{row[m.csvColumn] || '—'}</span>
                              </div>
                            ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={styles.modalActions}>
                  <button
                    style={styles.cancelButton}
                    onClick={() => {
                      setCsvData([]);
                      setCsvColumns([]);
                      setColumnMappings([]);
                    }}
                  >
                    Back
                  </button>
                  <button
                    style={{
                      ...styles.importActionButton,
                      opacity: importStatus === 'importing' ? 0.7 : 1,
                    }}
                    onClick={executeImport}
                    disabled={importStatus === 'importing' || !columnMappings.some((m) => m.appColumn === 'name')}
                  >
                    {importStatus === 'importing'
                      ? 'Importing...'
                      : importStatus === 'success'
                      ? 'Done!'
                      : `Import ${csvData.length} investors`}
                  </button>
                </div>

                {!columnMappings.some((m) => m.appColumn === 'name') && (
                  <p style={styles.warningText}>
                    Please map at least the investor name column to import.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
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
}

function EditableCell({ value, isEditing, onStartEdit, onEndEdit, onChange, onSave, onNavigate, placeholder }: EditableCellProps) {
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
        color: value ? 'inherit' : '#3a3a4a',
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
}

function StatusSelect({ value, isEditing, onStartEdit, onEndEdit, onChange, onNavigate }: StatusSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const isNavigatingRef = useRef(false);
  const colors = STATUS_COLORS[value];

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      isNavigatingRef.current = true;
      if (e.shiftKey) {
        onNavigate('left');
      } else {
        onNavigate('right');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      isNavigatingRef.current = true;
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
    if (!isNavigatingRef.current) {
      onEndEdit();
    }
    isNavigatingRef.current = false;
  };

  return (
    <select
      ref={selectRef}
      className="status-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onStartEdit}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        color: colors.text,
        boxShadow: isEditing ? '0 0 0 2px rgba(99, 102, 241, 0.3)' : 'none',
        background: isEditing ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
      }}
    >
      {STATUSES.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
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
}

function FitSelect({ value, isEditing, onStartEdit, onEndEdit, onChange, onNavigate }: FitSelectProps) {
  const selectRef = useRef<HTMLSelectElement>(null);
  const isNavigatingRef = useRef(false);

  useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      isNavigatingRef.current = true;
      if (e.shiftKey) {
        onNavigate('left');
      } else {
        onNavigate('right');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      isNavigatingRef.current = true;
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
    if (!isNavigatingRef.current) {
      onEndEdit();
    }
    isNavigatingRef.current = false;
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onChange(val === '' ? null : parseInt(val, 10));
  };

  const color = value !== null ? FIT_COLORS[value] : '#5a5a6a';

  return (
    <select
      ref={selectRef}
      className="status-select"
      value={value ?? ''}
      onChange={handleChange}
      onFocus={onStartEdit}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      style={{
        color: color,
        boxShadow: isEditing ? '0 0 0 2px rgba(99, 102, 241, 0.3)' : 'none',
        background: isEditing ? 'rgba(99, 102, 241, 0.1)' : 'transparent',
        minWidth: '40px',
      }}
    >
      <option value="">—</option>
      {[1, 2, 3, 4, 5].map((n) => (
        <option key={n} value={n}>
          {n}
        </option>
      ))}
    </select>
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
    gap: '24px',
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
