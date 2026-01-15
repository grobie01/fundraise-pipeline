'use client';

import { useState, useEffect, useRef } from 'react';

interface AttioList {
  id: string;
  name: string;
  slug: string;
}

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

const STATUSES = ['Lead', 'First Meeting', 'Partner Meeting', 'Term Sheet', 'Passed'];

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  appColumn: string | null;
}

export default function ExportPage() {
  const [lists, setLists] = useState<AttioList[]>([]);
  const [selectedListId, setSelectedListId] = useState('');
  const [listName, setListName] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingLists, setFetchingLists] = useState(true);
  const [result, setResult] = useState<{ url: string; investorCount: number } | null>(null);
  const [error, setError] = useState('');

  // CSV import state
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch Attio lists on mount
  useEffect(() => {
    async function fetchLists() {
      try {
        const response = await fetch('/api/attio/lists');
        if (response.ok) {
          const data = await response.json();
          setLists(data.lists || []);
        }
      } catch (err) {
        // Silently fail - Attio is optional
      } finally {
        setFetchingLists(false);
      }
    }
    fetchLists();
  }, []);

  const handleExport = async () => {
    if (!selectedListId) {
      setError('Please select an Attio list');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/attio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attioListId: selectedListId,
          listName: listName || lists.find(l => l.id === selectedListId)?.name || 'Imported Pipeline',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({ url: data.url, investorCount: data.investorCount });
      } else {
        const data = await response.json();
        setError(data.error || 'Export failed');
      }
    } catch (err) {
      setError('Failed to export. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateManual = async () => {
    if (!listName.trim()) {
      setError('Please enter a list name');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          investors: [],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({ url: data.url, investorCount: 0 });
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to create list');
      }
    } catch (err) {
      setError('Failed to create list. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // CSV Import Functions
  const fuzzyMatch = (csvCol: string, appCol: { key: string; label: string; aliases: string[] }): number => {
    const normalizedCsv = csvCol.toLowerCase().trim();
    const normalizedKey = appCol.key.toLowerCase();
    const normalizedLabel = appCol.label.toLowerCase();

    if (normalizedCsv === normalizedKey || normalizedCsv === normalizedLabel) return 100;
    if (appCol.aliases.some(a => normalizedCsv === a.toLowerCase())) return 95;
    if (normalizedCsv.includes(normalizedKey) || normalizedKey.includes(normalizedCsv)) return 80;
    if (normalizedCsv.includes(normalizedLabel) || normalizedLabel.includes(normalizedCsv)) return 75;
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

    const columns = lines[0].split(',').map(col => col.trim().replace(/^"|"$/g, ''));
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

      const mappings: ColumnMapping[] = columns.map(col => ({
        csvColumn: col,
        appColumn: findBestMatch(col),
      }));
      setColumnMappings(mappings);
      setImportStatus('idle');
      setError('');
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
    if (!listName.trim()) {
      setError('Please enter a pipeline name');
      return;
    }

    setImportStatus('importing');
    setError('');

    try {
      // First create the list
      const listResponse = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: listName, investors: [] }),
      });

      if (!listResponse.ok) {
        throw new Error('Failed to create list');
      }

      const listData = await listResponse.json();
      const listId = listData.id;

      // Then add investors
      let importedCount = 0;
      for (const row of csvData) {
        const investor: Record<string, any> = { status: 'Lead' };

        columnMappings.forEach(mapping => {
          if (mapping.appColumn && row[mapping.csvColumn]) {
            const value = row[mapping.csvColumn];

            if (mapping.appColumn === 'fit') {
              const num = parseInt(value, 10);
              if (num >= 1 && num <= 5) {
                investor.fit = num;
              }
            } else if (mapping.appColumn === 'status') {
              const matchedStatus = STATUSES.find(s =>
                s.toLowerCase() === value.toLowerCase() ||
                s.toLowerCase().includes(value.toLowerCase()) ||
                value.toLowerCase().includes(s.toLowerCase())
              );
              if (matchedStatus) {
                investor.status = matchedStatus;
              }
            } else {
              investor[mapping.appColumn] = value;
            }
          }
        });

        if (investor.name) {
          const response = await fetch(`/api/lists/${listId}/investors`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(investor),
          });
          if (response.ok) {
            importedCount++;
          }
        }
      }

      setImportStatus('success');
      setResult({ url: listData.url, investorCount: importedCount });

      // Reset CSV state
      setTimeout(() => {
        setCsvData([]);
        setCsvColumns([]);
        setColumnMappings([]);
        setImportStatus('idle');
      }, 1500);
    } catch (err) {
      console.error('Import failed:', err);
      setImportStatus('error');
      setError('Failed to import. Please try again.');
    }
  };

  const resetCsvImport = () => {
    setCsvData([]);
    setCsvColumns([]);
    setColumnMappings([]);
    setImportStatus('idle');
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.logoMark}></div>
        <h1 style={styles.title}>Create Pipeline</h1>
        <p style={styles.subtitle}>Create a shareable investor pipeline from CSV, Attio, or start fresh</p>

        {/* CSV Import Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Import from CSV</h2>

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
              onClick={() => fileInputRef.current?.click()}
            >
              <div style={styles.dropZoneContent}>
                <div style={styles.dropIcon}>📄</div>
                <p style={styles.dropText}>Drag and drop a CSV file here</p>
                <p style={styles.dropSubtext}>or click to browse</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </div>
          ) : (
            <div style={styles.mappingContainer}>
              <p style={styles.mappingInfo}>
                Found {csvData.length} rows with {csvColumns.length} columns.
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
                      <option value="">Don&apos;t import</option>
                      {COLUMN_CONFIG.map((col) => (
                        <option key={col.key} value={col.key}>
                          {col.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              <label style={{ ...styles.label, marginTop: '16px' }}>Pipeline Name</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g., Acme Corp Series A"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              />

              <div style={styles.buttonRow}>
                <button style={styles.buttonSecondary} onClick={resetCsvImport}>
                  Back
                </button>
                <button
                  style={{
                    ...styles.button,
                    flex: 1,
                    opacity: importStatus === 'importing' || !columnMappings.some(m => m.appColumn === 'name') || !listName.trim() ? 0.5 : 1,
                  }}
                  onClick={executeImport}
                  disabled={importStatus === 'importing' || !columnMappings.some(m => m.appColumn === 'name') || !listName.trim()}
                >
                  {importStatus === 'importing'
                    ? 'Importing...'
                    : importStatus === 'success'
                    ? 'Done!'
                    : `Import ${csvData.length} investors`}
                </button>
              </div>

              {!columnMappings.some(m => m.appColumn === 'name') && (
                <p style={styles.warningText}>
                  Map at least the investor name column to import.
                </p>
              )}
            </div>
          )}
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        {/* Attio Export Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Import from Attio</h2>

          {fetchingLists ? (
            <p style={styles.loadingText}>Loading Attio lists...</p>
          ) : lists.length > 0 ? (
            <>
              <label style={styles.label}>Select Attio List</label>
              <select
                style={styles.select}
                value={selectedListId}
                onChange={(e) => setSelectedListId(e.target.value)}
              >
                <option value="">Choose a list...</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>

              <label style={styles.label}>Pipeline Name (optional)</label>
              <input
                style={styles.input}
                type="text"
                placeholder="e.g., Acme Corp Series A"
                value={listName}
                onChange={(e) => setListName(e.target.value)}
              />

              <button
                style={{
                  ...styles.button,
                  opacity: loading || !selectedListId ? 0.5 : 1,
                }}
                onClick={handleExport}
                disabled={loading || !selectedListId}
              >
                {loading ? 'Exporting...' : 'Export from Attio'}
              </button>
            </>
          ) : (
            <p style={styles.noListsText}>
              No Attio lists found. Configure your API key or use CSV import above.
            </p>
          )}
        </div>

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        {/* Manual Create Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Create Empty Pipeline</h2>

          <label style={styles.label}>Pipeline Name</label>
          <input
            style={styles.input}
            type="text"
            placeholder="e.g., Acme Corp Series A"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
          />

          <button
            style={{
              ...styles.buttonSecondary,
              width: '100%',
              opacity: loading || !listName.trim() ? 0.5 : 1,
            }}
            onClick={handleCreateManual}
            disabled={loading || !listName.trim()}
          >
            {loading ? 'Creating...' : 'Create Empty Pipeline'}
          </button>
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {result && (
          <div style={styles.success}>
            <p style={styles.successText}>
              Pipeline created with {result.investorCount} investors!
            </p>
            <a href={result.url} style={styles.link}>
              {result.url}
            </a>
            <button
              style={styles.copyButton}
              onClick={() => navigator.clipboard.writeText(result.url)}
            >
              Copy Link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: '#0a0a0f',
    fontFamily: "'Space Grotesk', sans-serif",
    color: '#a0a0b0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 20px',
  },
  card: {
    background: '#12121a',
    borderRadius: '16px',
    padding: '40px',
    maxWidth: '520px',
    width: '100%',
    border: '1px solid #1a1a2a',
  },
  logoMark: {
    width: '48px',
    height: '48px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    borderRadius: '12px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#ffffff',
    fontFamily: "'JetBrains Mono', monospace",
    margin: '0 0 8px 0',
  },
  subtitle: {
    fontSize: '14px',
    color: '#5a5a6a',
    margin: '0 0 32px 0',
  },
  section: {
    marginBottom: '24px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#8a8a9a',
    margin: '0 0 16px 0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  label: {
    display: 'block',
    fontSize: '12px',
    color: '#6a6a7a',
    marginBottom: '6px',
    fontFamily: "'JetBrains Mono', monospace",
  },
  select: {
    width: '100%',
    padding: '12px 16px',
    background: '#0a0a0f',
    border: '1px solid #2a2a3a',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '14px',
    fontFamily: "'Space Grotesk', sans-serif",
    marginBottom: '16px',
    cursor: 'pointer',
    outline: 'none',
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    background: '#0a0a0f',
    border: '1px solid #2a2a3a',
    borderRadius: '8px',
    color: '#e0e0e0',
    fontSize: '14px',
    fontFamily: "'Space Grotesk', sans-serif",
    marginBottom: '16px',
    outline: 'none',
  },
  button: {
    width: '100%',
    padding: '14px 24px',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    border: 'none',
    borderRadius: '8px',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  buttonSecondary: {
    padding: '14px 24px',
    background: 'transparent',
    border: '1px solid #3a3a4a',
    borderRadius: '8px',
    color: '#a0a0b0',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    fontFamily: "'Space Grotesk', sans-serif",
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '24px 0',
  },
  dividerText: {
    flex: 1,
    textAlign: 'center',
    fontSize: '12px',
    color: '#4a4a5a',
    position: 'relative',
  },
  loadingText: {
    fontSize: '14px',
    color: '#6a6a7a',
  },
  noListsText: {
    fontSize: '14px',
    color: '#6a6a7a',
    lineHeight: 1.5,
  },
  error: {
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '8px',
    padding: '12px 16px',
    color: '#f87171',
    fontSize: '13px',
    marginTop: '16px',
  },
  success: {
    background: 'rgba(34, 197, 94, 0.1)',
    border: '1px solid rgba(34, 197, 94, 0.3)',
    borderRadius: '8px',
    padding: '16px',
    marginTop: '16px',
  },
  successText: {
    color: '#4ade80',
    fontSize: '14px',
    margin: '0 0 12px 0',
  },
  link: {
    display: 'block',
    color: '#818cf8',
    fontSize: '13px',
    wordBreak: 'break-all',
    marginBottom: '12px',
    textDecoration: 'none',
  },
  copyButton: {
    padding: '8px 16px',
    background: 'rgba(99, 102, 241, 0.2)',
    border: '1px solid rgba(99, 102, 241, 0.3)',
    borderRadius: '6px',
    color: '#818cf8',
    fontSize: '12px',
    cursor: 'pointer',
    fontFamily: "'JetBrains Mono', monospace",
  },
  dropZone: {
    padding: '32px',
    border: '2px dashed #2a2a3a',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
  },
  dropIcon: {
    fontSize: '32px',
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
  mappingContainer: {
    padding: '0',
  },
  mappingInfo: {
    color: '#a0a0b0',
    fontSize: '13px',
    margin: '0 0 16px 0',
  },
  mappingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    marginBottom: '16px',
  },
  mappingRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  csvColumnName: {
    flex: 1,
    color: '#e0e0e0',
    fontSize: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '8px 10px',
    borderRadius: '4px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mappingArrow: {
    color: '#5a5a6a',
    fontSize: '12px',
  },
  mappingSelect: {
    flex: 1,
    background: '#1a1a2e',
    border: '1px solid #2a2a3a',
    color: '#e0e0e0',
    padding: '8px 10px',
    borderRadius: '4px',
    fontSize: '12px',
    fontFamily: "'Space Grotesk', sans-serif",
    cursor: 'pointer',
  },
  warningText: {
    color: '#f97316',
    fontSize: '12px',
    marginTop: '12px',
    textAlign: 'center',
  },
};
