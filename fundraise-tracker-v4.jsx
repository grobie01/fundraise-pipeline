import React, { useState, useCallback, useMemo } from 'react';

const STATUSES = ['Lead', 'First Meeting', 'Partner Meeting', 'Term Sheet', 'Passed'];
const FIELDS = ['name', 'status', 'nextSteps', 'notes', 'amount', 'primaryContact', 'firmContact'];

const STATUS_COLORS = {
  'Lead': { bg: 'rgba(99, 102, 241, 0.15)', text: '#818cf8', border: '#6366f1' },
  'First Meeting': { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', border: '#22c55e' },
  'Partner Meeting': { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', border: '#eab308' },
  'Term Sheet': { bg: 'rgba(6, 182, 212, 0.15)', text: '#22d3ee', border: '#06b6d4' },
  'Passed': { bg: 'rgba(239, 68, 68, 0.1)', text: '#f87171', border: '#ef4444' },
};

const INITIAL_INVESTORS = [
  { id: 23, name: 'Saint Gobain', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 24, name: 'Initialized', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 25, name: 'Divco West', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 26, name: 'Valia VC', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 27, name: 'Foundamental VC', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 28, name: 'Cemex', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 29, name: 'Hilti', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 46, name: 'General Catalyst', status: 'Lead', nextSteps: '', notes: '', amount: '$15M', primaryContact: '', firmContact: 'Sarah' },
  { id: 47, name: 'JLL', status: 'Lead', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 32, name: 'Urban Innovation Fund', status: 'First Meeting', nextSteps: 'Send deck follow-up', notes: 'Good meeting, interested in climate angle', amount: '$5M', primaryContact: 'Sarah Chen', firmContact: 'Mike' },
  { id: 34, name: 'Stanley Ventures', status: 'First Meeting', nextSteps: 'Schedule partner call', notes: '', amount: '$10M', primaryContact: 'Mike Stanley', firmContact: 'Sarah' },
  { id: 35, name: 'Picuscap', status: 'First Meeting', nextSteps: '', notes: '', amount: '', primaryContact: '', firmContact: '' },
  { id: 36, name: 'Revel Partners', status: 'First Meeting', nextSteps: 'Send customer references', notes: 'Want to talk to 2 customers', amount: '$8M', primaryContact: 'James Liu', firmContact: 'Mike' },
  { id: 40, name: 'Sequoia Capital', status: 'Partner Meeting', nextSteps: 'Monday GP presentation', notes: 'Strong interest, prep metrics deck', amount: '$20M', primaryContact: 'Alfred Lin', firmContact: 'Sarah' },
  { id: 41, name: 'Andreessen Horowitz', status: 'Partner Meeting', nextSteps: 'Thursday partner meeting', notes: '', amount: '$25M', primaryContact: 'Marc Andreessen', firmContact: 'Mike' },
  { id: 50, name: 'Founders Fund', status: 'Term Sheet', nextSteps: 'Legal review by Friday', notes: 'Strong offer, reviewing terms', amount: '$18M', primaryContact: 'Keith Rabois', firmContact: 'Sarah' },
  { id: 55, name: 'Accel', status: 'Passed', nextSteps: '', notes: 'Too early for current thesis', amount: '', primaryContact: 'Dan Levine', firmContact: '' },
  { id: 56, name: 'Lightspeed', status: 'Passed', nextSteps: '', notes: 'Passed - competitive conflict', amount: '', primaryContact: '', firmContact: '' },
];

export default function FundraiseTracker() {
  const [investors, setInvestors] = useState(INITIAL_INVESTORS);
  const [collapsedSections, setCollapsedSections] = useState({});
  const [editingCell, setEditingCell] = useState(null);

  // Build ordered list of visible investors (respecting collapsed sections)
  const visibleInvestors = useMemo(() => {
    const result = [];
    STATUSES.forEach(status => {
      if (!collapsedSections[status]) {
        investors.filter(inv => inv.status === status).forEach(inv => result.push(inv));
      }
    });
    return result;
  }, [investors, collapsedSections]);

  const navigateToCell = useCallback((currentId, currentField, direction) => {
    const currentFieldIndex = FIELDS.indexOf(currentField);
    const currentRowIndex = visibleInvestors.findIndex(inv => inv.id === currentId);
    
    if (direction === 'right') {
      // Tab: move to next field in same row
      const nextFieldIndex = currentFieldIndex + 1;
      if (nextFieldIndex < FIELDS.length) {
        setEditingCell({ id: currentId, field: FIELDS[nextFieldIndex] });
      } else {
        // Wrap to first field of next row
        const nextRowIndex = currentRowIndex + 1;
        if (nextRowIndex < visibleInvestors.length) {
          setEditingCell({ id: visibleInvestors[nextRowIndex].id, field: FIELDS[0] });
        } else {
          setEditingCell(null);
        }
      }
    } else if (direction === 'left') {
      // Shift+Tab: move to previous field in same row
      const prevFieldIndex = currentFieldIndex - 1;
      if (prevFieldIndex >= 0) {
        setEditingCell({ id: currentId, field: FIELDS[prevFieldIndex] });
      } else {
        // Wrap to last field of previous row
        const prevRowIndex = currentRowIndex - 1;
        if (prevRowIndex >= 0) {
          setEditingCell({ id: visibleInvestors[prevRowIndex].id, field: FIELDS[FIELDS.length - 1] });
        } else {
          setEditingCell(null);
        }
      }
    } else if (direction === 'down') {
      // Enter: move to same field in next row
      const nextRowIndex = currentRowIndex + 1;
      if (nextRowIndex < visibleInvestors.length) {
        setEditingCell({ id: visibleInvestors[nextRowIndex].id, field: currentField });
      } else {
        setEditingCell(null);
      }
    } else if (direction === 'up') {
      // Shift+Enter: move to same field in previous row
      const prevRowIndex = currentRowIndex - 1;
      if (prevRowIndex >= 0) {
        setEditingCell({ id: visibleInvestors[prevRowIndex].id, field: currentField });
      } else {
        setEditingCell(null);
      }
    }
  }, [visibleInvestors]);

  const toggleSection = (status) => {
    setCollapsedSections(prev => ({ ...prev, [status]: !prev[status] }));
  };

  const getInvestorsByStatus = (status) => investors.filter(inv => inv.status === status);

  const updateInvestor = (id, field, value) => {
    setInvestors(prev => prev.map(inv => 
      inv.id === id ? { ...inv, [field]: value } : inv
    ));
  };

  const addInvestor = (status) => {
    const newInvestor = {
      id: Date.now(),
      name: '',
      status: status,
      nextSteps: '',
      notes: '',
      amount: '',
      primaryContact: '',
      firmContact: ''
    };
    setInvestors(prev => [...prev, newInvestor]);
    setEditingCell({ id: newInvestor.id, field: 'name' });
  };

  const deleteInvestor = (id) => {
    setInvestors(prev => prev.filter(inv => inv.id !== id));
  };

  const calculateSum = (status) => {
    const amounts = getInvestorsByStatus(status)
      .map(inv => {
        const match = inv.amount.match(/\$?([\d.]+)M?/i);
        return match ? parseFloat(match[1]) : 0;
      });
    const total = amounts.reduce((a, b) => a + b, 0);
    return total > 0 ? `$${total}M` : '—';
  };

  const totalActive = investors.filter(i => i.status !== 'Passed').length;
  const totalTermSheets = getInvestorsByStatus('Term Sheet').length;

  return (
    <div style={styles.container}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');
        
        * { box-sizing: border-box; }
        body { margin: 0; background: #0a0a0f; }
        
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
      `}</style>

      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.logoMark}></div>
          <div>
            <h1 style={styles.title}>Series A Pipeline</h1>
            <p style={styles.subtitle}>{investors.length} investors tracked</p>
          </div>
        </div>
        <div style={styles.stats}>
          <div style={styles.stat}>
            <span style={styles.statValue}>{totalActive}</span>
            <span style={styles.statLabel}>active</span>
          </div>
          <div style={styles.statDivider}></div>
          <div style={styles.stat}>
            <span style={{...styles.statValue, color: '#22d3ee'}}>{totalTermSheets}</span>
            <span style={styles.statLabel}>term sheets</span>
          </div>
        </div>
      </header>

      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{...styles.th, width: 36}}></th>
              <th style={{...styles.th, width: 180}}>Investor</th>
              <th style={{...styles.th, width: 120}}>Status</th>
              <th style={{...styles.th, width: 180}}>Next Steps</th>
              <th style={{...styles.th, width: 220}}>Notes</th>
              <th style={{...styles.th, width: 80}}>Amount</th>
              <th style={{...styles.th, width: 140}}>VC Contact</th>
              <th style={{...styles.th, width: 100}}>Our Contact</th>
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
                    <td colSpan={8} style={styles.sectionHeaderCell}>
                      <div style={styles.sectionHeaderContent}>
                        <div style={styles.sectionLeft}>
                          <span style={{
                            ...styles.chevron,
                            transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                          }}>▾</span>
                          <span style={{
                            ...styles.statusIndicator,
                            background: colors.border
                          }}></span>
                          <span style={{...styles.sectionTitle, color: colors.text}}>{status}</span>
                          <span style={styles.sectionCount}>{statusInvestors.length}</span>
                        </div>
                        <div style={styles.sectionRight}>
                          <span style={styles.sumValue}>{calculateSum(status)}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                  
                  {!isCollapsed && statusInvestors.map((investor, idx) => (
                    <tr 
                      key={investor.id} 
                      className="row" 
                      style={{
                        ...styles.row,
                        animation: `fadeIn 0.2s ease ${idx * 0.02}s both`
                      }}
                    >
                      <td style={styles.cellAction}>
                        <button 
                          className="delete-btn"
                          style={styles.deleteButton}
                          onClick={() => deleteInvestor(investor.id)}
                        >×</button>
                      </td>
                      <td style={{...styles.cell, fontWeight: 500, color: '#fff'}}>
                        <EditableCell
                          value={investor.name}
                          isEditing={editingCell?.id === investor.id && editingCell?.field === 'name'}
                          onStartEdit={() => setEditingCell({ id: investor.id, field: 'name' })}
                          onEndEdit={() => setEditingCell(null)}
                          onChange={(val) => updateInvestor(investor.id, 'name', val)}
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
                          onChange={(val) => updateInvestor(investor.id, 'status', val)}
                          onNavigate={(dir) => navigateToCell(investor.id, 'status', dir)}
                        />
                      </td>
                      <td style={styles.cell}>
                        <EditableCell
                          value={investor.nextSteps}
                          isEditing={editingCell?.id === investor.id && editingCell?.field === 'nextSteps'}
                          onStartEdit={() => setEditingCell({ id: investor.id, field: 'nextSteps' })}
                          onEndEdit={() => setEditingCell(null)}
                          onChange={(val) => updateInvestor(investor.id, 'nextSteps', val)}
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
                          onChange={(val) => updateInvestor(investor.id, 'notes', val)}
                          onNavigate={(dir) => navigateToCell(investor.id, 'notes', dir)}
                          placeholder="—"
                        />
                      </td>
                      <td style={{...styles.cell, fontFamily: "'JetBrains Mono', monospace", fontSize: '12px'}}>
                        <EditableCell
                          value={investor.amount}
                          isEditing={editingCell?.id === investor.id && editingCell?.field === 'amount'}
                          onStartEdit={() => setEditingCell({ id: investor.id, field: 'amount' })}
                          onEndEdit={() => setEditingCell(null)}
                          onChange={(val) => updateInvestor(investor.id, 'amount', val)}
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
                          onChange={(val) => updateInvestor(investor.id, 'primaryContact', val)}
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
                          onChange={(val) => updateInvestor(investor.id, 'firmContact', val)}
                          onNavigate={(dir) => navigateToCell(investor.id, 'firmContact', dir)}
                          placeholder="—"
                        />
                      </td>
                    </tr>
                  ))}
                  
                  {!isCollapsed && (
                    <tr className="add-row" style={styles.addRow} onClick={() => addInvestor(status)}>
                      <td style={styles.cellAction}></td>
                      <td colSpan={7} style={styles.addRowCell}>
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
    </div>
  );
}

function EditableCell({ value, isEditing, onStartEdit, onEndEdit, onChange, onNavigate, placeholder }) {
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        onNavigate('left');
      } else {
        onNavigate('right');
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) {
        onNavigate('up');
      } else {
        onNavigate('down');
      }
    } else if (e.key === 'Escape') {
      onEndEdit();
    }
  };

  if (isEditing) {
    return (
      <input
        className="cell-input"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onEndEdit}
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
        color: value ? 'inherit' : '#3a3a4a'
      }}
    >
      {value || placeholder}
    </div>
  );
}

function StatusSelect({ value, isEditing, onStartEdit, onEndEdit, onChange, onNavigate }) {
  const selectRef = React.useRef(null);
  const isNavigatingRef = React.useRef(false);
  const colors = STATUS_COLORS[value];

  React.useEffect(() => {
    if (isEditing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [isEditing]);

  const handleKeyDown = (e) => {
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
    // Don't end edit if we're navigating to another cell
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
      {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

const styles = {
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
};
