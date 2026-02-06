'use client';

import { useState, useEffect, useRef } from 'react';

interface AttioList {
  id: string;
  name: string;
  slug: string;
}

interface AttioAttribute {
  id: string;
  title: string;
  slug: string;
  type: string;
}

interface AttioColumnMapping {
  attioSlug: string;
  attioTitle: string;
  displayName: string;
  selected: boolean;
  sampleValues: string[];
  order: number;
}

const STATUSES = ['Lead', 'First Meeting', 'Partner Meeting', 'Term Sheet', 'Passed'];

// Columns to ignore during CSV import (system/metadata columns)
const IGNORED_CSV_COLUMNS = [
  'entry id',
  'record id',
  '"status" changed at',
  '"status" previous values',
  'status changed at',
  'status previous values',
  '""status"" changed at',
  '""status"" previous values',
];

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  displayName: string;
  selected: boolean;
  sampleValues: string[];
  order: number;
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
  const [csvStatusColumn, setCsvStatusColumn] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [draggedColumnIndex, setDraggedColumnIndex] = useState<number | null>(null);
  const [importStatus, setImportStatus] = useState<'idle' | 'importing' | 'success' | 'error'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Attio mapping state
  const [attioAttributes, setAttioAttributes] = useState<AttioAttribute[]>([]);
  const [attioColumnMappings, setAttioColumnMappings] = useState<AttioColumnMapping[]>([]);
  const [attioStatusColumn, setAttioStatusColumn] = useState<string>('');
  const [draggedAttioColumnIndex, setDraggedAttioColumnIndex] = useState<number | null>(null);
  const [attioImportStatus, setAttioImportStatus] = useState<'idle' | 'loading' | 'mapping' | 'importing' | 'success' | 'error'>('idle');
  const [attioEntryCount, setAttioEntryCount] = useState<number | null>(null);

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
  const toTitleCase = (str: string): string => {
    return str
      .split(/[\s_-]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  const findBestStatusColumn = (columns: string[]): string => {
    const statusAliases = ['status', 'stage', 'pipeline', 'progress'];
    for (const col of columns) {
      const normalized = col.toLowerCase().trim();
      if (statusAliases.some(alias => normalized.includes(alias))) {
        return col;
      }
    }
    return '';
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

      // Filter out ignored columns
      const shouldIgnoreColumn = (columnName: string): boolean => {
        const normalized = columnName.toLowerCase().trim();
        // Also check without outer quotes in case they exist
        const withoutOuterQuotes = normalized.replace(/^"|"$/g, '');
        // Remove all quotes for comparison
        const withoutAnyQuotes = normalized.replace(/"/g, '');

        // Debug: log column names to console
        console.log('Column:', columnName, '| Normalized:', normalized, '| No quotes:', withoutAnyQuotes);

        // Check exact matches first
        if (IGNORED_CSV_COLUMNS.some(ignored =>
          normalized === ignored ||
          withoutOuterQuotes === ignored
        )) {
          return true;
        }

        // Also check for pattern matches (for columns with quotes in them)
        if (withoutAnyQuotes.includes('status') && (
          withoutAnyQuotes.includes('changed at') ||
          withoutAnyQuotes.includes('previous values')
        )) {
          return true;
        }

        return false;
      };

      const filteredColumns = columns.filter(col => !shouldIgnoreColumn(col));
      console.log('Filtered columns:', filteredColumns);

      setCsvColumns(filteredColumns);
      setCsvData(rows);

      // Set default pipeline name to CSV filename (without extension)
      const fileName = file.name.replace(/\.csv$/i, '');
      setListName(fileName);

      // Extract sample values (first 3 non-empty values for each column)
      const getSampleValues = (columnName: string): string[] => {
        const samples: string[] = [];
        for (const row of rows) {
          const val = row[columnName]?.trim();
          if (val && !samples.includes(val)) {
            samples.push(val);
            if (samples.length >= 3) break;
          }
        }
        return samples;
      };

      const mappings: ColumnMapping[] = filteredColumns.map((col, index) => ({
        csvColumn: col,
        displayName: toTitleCase(col),
        selected: true, // All columns selected by default
        sampleValues: getSampleValues(col),
        order: index,
      }));
      setColumnMappings(mappings);
      setCsvStatusColumn(findBestStatusColumn(filteredColumns));
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

  const toggleColumnSelection = (csvColumn: string) => {
    setColumnMappings(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, selected: !m.selected } : m))
    );
  };

  const updateColumnDisplayName = (csvColumn: string, newName: string) => {
    setColumnMappings(prev =>
      prev.map(m => (m.csvColumn === csvColumn ? { ...m, displayName: newName } : m))
    );
  };

  const handleColumnDragStart = (index: number) => {
    setDraggedColumnIndex(index);
  };

  const handleColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedColumnIndex === null || draggedColumnIndex === index) return;

    setColumnMappings(prev => {
      const newMappings = [...prev];
      const draggedItem = newMappings[draggedColumnIndex];
      newMappings.splice(draggedColumnIndex, 1);
      newMappings.splice(index, 0, draggedItem);

      // Update order values
      return newMappings.map((m, i) => ({ ...m, order: i }));
    });
    setDraggedColumnIndex(index);
  };

  const handleColumnDragEnd = () => {
    setDraggedColumnIndex(null);
  };

  const executeImport = async () => {
    if (!listName.trim()) {
      setError('Please enter a pipeline name');
      return;
    }

    if (!csvStatusColumn) {
      setError('Please select a Status column');
      return;
    }

    setImportStatus('importing');
    setError('');

    try {
      // Get selected columns and sort by order
      const selectedMappings = columnMappings
        .filter(m => m.selected)
        .sort((a, b) => a.order - b.order);

      // Build column order array (excluding status column)
      const columnOrder = ['status', ...selectedMappings
        .filter(m => m.csvColumn !== csvStatusColumn)
        .map(m => m.displayName)];

      // First create the list with column order
      const listResponse = await fetch('/api/lists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: listName,
          investors: [],
          column_order: columnOrder,
        }),
      });

      if (!listResponse.ok) {
        throw new Error('Failed to create list');
      }

      const listData = await listResponse.json();
      const listId = listData.id;

      // Then add investors
      let importedCount = 0;
      for (const row of csvData) {
        const customFields: Record<string, any> = {};

        // Get status from the status column
        let status = 'Lead';
        if (csvStatusColumn && row[csvStatusColumn]) {
          const statusValue = row[csvStatusColumn];
          const matchedStatus = STATUSES.find(s =>
            s.toLowerCase() === statusValue.toLowerCase() ||
            s.toLowerCase().includes(statusValue.toLowerCase()) ||
            statusValue.toLowerCase().includes(s.toLowerCase())
          );
          if (matchedStatus) {
            status = matchedStatus;
          }
        }

        // Add all selected columns to custom fields (except the status column)
        selectedMappings.forEach(mapping => {
          if (row[mapping.csvColumn] && mapping.csvColumn !== csvStatusColumn) {
            customFields[mapping.displayName] = row[mapping.csvColumn];
          }
        });

        // Extract name from custom fields (required field)
        const nameField = Object.keys(customFields).find(key =>
          key.toLowerCase().includes('name') ||
          key.toLowerCase().includes('investor') ||
          key.toLowerCase().includes('company') ||
          key.toLowerCase().includes('firm')
        );
        const name = nameField ? customFields[nameField] : Object.values(customFields)[0] || 'Unknown';

        const response = await fetch(`/api/lists/${listId}/investors`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            status,
            custom_fields: customFields,
          }),
        });
        if (response.ok) {
          importedCount++;
        }
      }

      setImportStatus('success');
      setResult({ url: listData.url, investorCount: importedCount });

      // Reset CSV state
      setTimeout(() => {
        setCsvData([]);
        setCsvColumns([]);
        setColumnMappings([]);
        setCsvStatusColumn('');
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
    setCsvStatusColumn('');
    setImportStatus('idle');
  };

  // Attio Import Functions
  const findBestStatusColumnAttio = (attributes: AttioAttribute[]): string => {
    const statusAliases = ['status', 'stage', 'pipeline', 'progress'];
    for (const attr of attributes) {
      const normalized = attr.title.toLowerCase().trim();
      if (statusAliases.some(alias => normalized.includes(alias))) {
        return attr.slug;
      }
    }
    return '';
  };

  const handleAttioListSelect = async (listId: string) => {
    setSelectedListId(listId);
    setAttioImportStatus('idle');
    setAttioAttributes([]);
    setAttioColumnMappings([]);
    setAttioEntryCount(null);
    setError('');

    if (!listId) return;

    // Set default pipeline name to Attio list name
    const selectedList = lists.find(l => l.id === listId);
    if (selectedList) {
      setListName(selectedList.name);
    }

    setAttioImportStatus('loading');

    try {
      // Fetch attributes and entry count in parallel
      const [attrResponse, entriesResponse] = await Promise.all([
        fetch(`/api/attio/lists/${listId}/attributes`),
        fetch(`/api/attio/lists/${listId}/entries`),
      ]);

      if (!attrResponse.ok) {
        throw new Error('Failed to fetch Attio list attributes');
      }

      const attrData = await attrResponse.json();
      const attributes: AttioAttribute[] = attrData.attributes || [];
      setAttioAttributes(attributes);

      // Get entry count and sample values
      let samples: Record<string, string[]> = {};
      if (entriesResponse.ok) {
        const entriesData = await entriesResponse.json();
        setAttioEntryCount(entriesData.count || 0);
        samples = entriesData.samples || {};
      }

      // Create mappings with all columns selected by default
      // Put "Record" first (if it exists), then all other attributes
      const mappings: AttioColumnMapping[] = attributes.map((attr, index) => ({
        attioSlug: attr.slug,
        attioTitle: attr.title,
        displayName: attr.title,
        selected: true, // All columns selected by default
        sampleValues: samples[attr.slug] || [],
        order: attr.slug === '__parent_record__' ? -1 : index,
      }));

      // Sort so Record is first
      const sortedMappings = mappings.sort((a, b) => a.order - b.order);
      // Reassign order sequentially
      sortedMappings.forEach((m, i) => m.order = i);

      setAttioColumnMappings(sortedMappings);
      setAttioStatusColumn(findBestStatusColumnAttio(attributes));

      setAttioImportStatus('mapping');
    } catch (err) {
      console.error('Error fetching Attio attributes:', err);
      setError('Failed to fetch Attio list structure');
      setAttioImportStatus('error');
    }
  };

  const toggleAttioColumnSelection = (attioSlug: string) => {
    setAttioColumnMappings(prev =>
      prev.map(m => (m.attioSlug === attioSlug ? { ...m, selected: !m.selected } : m))
    );
  };

  const updateAttioColumnDisplayName = (attioSlug: string, newName: string) => {
    setAttioColumnMappings(prev =>
      prev.map(m => (m.attioSlug === attioSlug ? { ...m, displayName: newName } : m))
    );
  };

  const handleAttioColumnDragStart = (index: number) => {
    setDraggedAttioColumnIndex(index);
  };

  const handleAttioColumnDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedAttioColumnIndex === null || draggedAttioColumnIndex === index) return;

    setAttioColumnMappings(prev => {
      const newMappings = [...prev];
      const draggedItem = newMappings[draggedAttioColumnIndex];
      newMappings.splice(draggedAttioColumnIndex, 1);
      newMappings.splice(index, 0, draggedItem);

      // Update order values
      return newMappings.map((m, i) => ({ ...m, order: i }));
    });
    setDraggedAttioColumnIndex(index);
  };

  const handleAttioColumnDragEnd = () => {
    setDraggedAttioColumnIndex(null);
  };

  const executeAttioImport = async () => {
    if (!listName.trim()) {
      setError('Please enter a pipeline name');
      return;
    }

    if (!attioStatusColumn) {
      setError('Please select a Status column');
      return;
    }

    setAttioImportStatus('importing');
    setError('');

    try {
      // Get selected columns sorted by order
      const selectedMappings = attioColumnMappings
        .filter(m => m.selected)
        .sort((a, b) => a.order - b.order);

      const selectedColumns = selectedMappings.map(m => m.attioSlug);

      // Build column display name mapping
      const columnDisplayNames: Record<string, string> = {};
      selectedMappings.forEach(m => {
        columnDisplayNames[m.attioSlug] = m.displayName;
      });

      // Build column order array (excluding status column)
      const columnOrder = ['status', ...selectedMappings
        .filter(m => m.attioSlug !== attioStatusColumn)
        .map(m => m.displayName)];

      const response = await fetch('/api/attio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attioListId: selectedListId,
          listName: listName || lists.find(l => l.id === selectedListId)?.name || 'Imported Pipeline',
          selectedColumns,
          statusColumn: attioStatusColumn,
          columnDisplayNames,
          columnOrder,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setResult({ url: data.url, investorCount: data.investorCount });
        setAttioImportStatus('success');

        // Reset Attio state after a delay
        setTimeout(() => {
          setSelectedListId('');
          setAttioAttributes([]);
          setAttioColumnMappings([]);
          setAttioStatusColumn('');
          setAttioImportStatus('idle');
          setAttioEntryCount(null);
        }, 1500);
      } else {
        const data = await response.json();
        setError(data.error || 'Export failed');
        setAttioImportStatus('error');
      }
    } catch (err) {
      console.error('Attio import failed:', err);
      setAttioImportStatus('error');
      setError('Failed to import from Attio. Please try again.');
    }
  };

  const resetAttioImport = () => {
    setSelectedListId('');
    setAttioAttributes([]);
    setAttioColumnMappings([]);
    setAttioStatusColumn('');
    setAttioImportStatus('idle');
    setAttioEntryCount(null);
  };

  return (
    <div style={styles.container}>
      <style>{`
        .tooltip-wrapper:hover .tooltip {
          opacity: 1 !important;
          visibility: visible !important;
        }
      `}</style>
      <div style={styles.card}>
        <div style={styles.logoMark}></div>
        <h1 style={styles.title}>Create Pipeline</h1>
        <p style={styles.subtitle}>Create a shareable investor pipeline from CSV, Attio, or start fresh</p>

        {/* Attio Export Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Import from Attio</h2>

          {fetchingLists ? (
            <p style={styles.loadingText}>Loading Attio lists...</p>
          ) : lists.length > 0 ? (
            attioImportStatus === 'mapping' || attioImportStatus === 'importing' || attioImportStatus === 'success' ? (
              // Mapping UI
              <div style={styles.mappingContainer}>
                <p style={styles.mappingInfo}>
                  {attioEntryCount !== null && `Found ${attioEntryCount} entries with ${attioAttributes.length} columns.`}
                </p>

                <div style={styles.mappingList}>
                  {attioColumnMappings.map((mapping, index) => (
                    <div
                      key={mapping.attioSlug}
                      draggable
                      onDragStart={() => handleAttioColumnDragStart(index)}
                      onDragOver={(e) => handleAttioColumnDragOver(e, index)}
                      onDragEnd={handleAttioColumnDragEnd}
                      style={{
                        ...styles.mappingRow,
                        opacity: draggedAttioColumnIndex === index ? 0.5 : 1,
                        cursor: 'move',
                      }}
                    >
                      <span style={styles.dragHandle}>⋮⋮</span>
                      <label style={styles.checkboxLabel}>
                        <input
                          type="checkbox"
                          checked={mapping.selected}
                          onChange={() => toggleAttioColumnSelection(mapping.attioSlug)}
                          style={styles.checkbox}
                        />
                        <div style={styles.tooltipWrapper} className="tooltip-wrapper">
                          <input
                            type="text"
                            value={mapping.displayName}
                            onChange={(e) => updateAttioColumnDisplayName(mapping.attioSlug, e.target.value)}
                            style={styles.columnNameInput}
                            onClick={(e) => e.stopPropagation()}
                          />
                          {mapping.sampleValues.length > 0 && (
                            <span style={styles.samplePreview}>
                              {mapping.sampleValues[0].length > 20
                                ? mapping.sampleValues[0].substring(0, 20) + '...'
                                : mapping.sampleValues[0]}
                            </span>
                          )}
                          {mapping.sampleValues.length > 0 && (
                            <div style={styles.tooltip} className="tooltip">
                              <div style={styles.tooltipLabel}>Examples:</div>
                              {mapping.sampleValues.map((val, i) => (
                                <div key={i} style={styles.tooltipValue}>{val}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      </label>
                    </div>
                  ))}
                </div>

                <label style={{ ...styles.label, marginTop: '16px' }}>Status Column (required for filtering)</label>
                <select
                  style={styles.select}
                  value={attioStatusColumn}
                  onChange={(e) => setAttioStatusColumn(e.target.value)}
                >
                  <option value="">Select status column...</option>
                  {attioColumnMappings.map((mapping) => (
                    <option key={mapping.attioSlug} value={mapping.attioSlug}>
                      {mapping.displayName}
                    </option>
                  ))}
                </select>

                <label style={{ ...styles.label, marginTop: '16px' }}>Pipeline Name</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="e.g., Acme Corp Series A"
                  value={listName}
                  onChange={(e) => setListName(e.target.value)}
                />

                <div style={styles.buttonRow}>
                  <button style={styles.buttonSecondary} onClick={resetAttioImport}>
                    Back
                  </button>
                  <button
                    style={{
                      ...styles.button,
                      flex: 1,
                      opacity: attioImportStatus === 'importing' || !attioStatusColumn || !attioColumnMappings.some(m => m.selected) || !listName.trim() ? 0.5 : 1,
                    }}
                    onClick={executeAttioImport}
                    disabled={attioImportStatus === 'importing' || !attioStatusColumn || !attioColumnMappings.some(m => m.selected) || !listName.trim()}
                  >
                    {attioImportStatus === 'importing'
                      ? 'Importing...'
                      : attioImportStatus === 'success'
                      ? 'Done!'
                      : `Import ${attioEntryCount || 0} investors`}
                  </button>
                </div>

                {(!attioStatusColumn || !attioColumnMappings.some(m => m.selected)) && (
                  <p style={styles.warningText}>
                    {!attioStatusColumn ? 'Please select a status column.' : 'Please select at least one column to import.'}
                  </p>
                )}
              </div>
            ) : (
              // List selection UI
              <>
                <label style={styles.label}>Select Attio List</label>
                <select
                  style={styles.select}
                  value={selectedListId}
                  onChange={(e) => handleAttioListSelect(e.target.value)}
                >
                  <option value="">Choose a list...</option>
                  {lists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name}
                    </option>
                  ))}
                </select>

                {attioImportStatus === 'loading' && (
                  <p style={styles.loadingText}>Loading list structure...</p>
                )}
              </>
            )
          ) : (
            <p style={styles.noListsText}>
              No Attio lists found. Configure your API key or use CSV import below.
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

        <div style={styles.divider}>
          <span style={styles.dividerText}>or</span>
        </div>

        {/* CSV Import Section */}
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Import from CSV</h2>

          {csvData.length === 0 ? (
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
                {columnMappings.map((mapping, index) => (
                  <div
                    key={mapping.csvColumn}
                    draggable
                    onDragStart={() => handleColumnDragStart(index)}
                    onDragOver={(e) => handleColumnDragOver(e, index)}
                    onDragEnd={handleColumnDragEnd}
                    style={{
                      ...styles.mappingRow,
                      opacity: draggedColumnIndex === index ? 0.5 : 1,
                      cursor: 'move',
                    }}
                  >
                    <span style={styles.dragHandle}>⋮⋮</span>
                    <label style={styles.checkboxLabel}>
                      <input
                        type="checkbox"
                        checked={mapping.selected}
                        onChange={() => toggleColumnSelection(mapping.csvColumn)}
                        style={styles.checkbox}
                      />
                      <div style={styles.tooltipWrapper} className="tooltip-wrapper">
                        <input
                          type="text"
                          value={mapping.displayName}
                          onChange={(e) => updateColumnDisplayName(mapping.csvColumn, e.target.value)}
                          style={styles.columnNameInput}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {mapping.sampleValues.length > 0 && (
                          <span style={styles.samplePreview}>
                            {mapping.sampleValues[0].length > 20
                              ? mapping.sampleValues[0].substring(0, 20) + '...'
                              : mapping.sampleValues[0]}
                          </span>
                        )}
                        {mapping.sampleValues.length > 0 && (
                          <div style={styles.tooltip} className="tooltip">
                            <div style={styles.tooltipLabel}>Examples:</div>
                            {mapping.sampleValues.map((val, i) => (
                              <div key={i} style={styles.tooltipValue}>{val}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                ))}
              </div>

              <label style={{ ...styles.label, marginTop: '16px' }}>Status Column (required for filtering)</label>
              <select
                style={styles.select}
                value={csvStatusColumn}
                onChange={(e) => setCsvStatusColumn(e.target.value)}
              >
                <option value="">Select status column...</option>
                {columnMappings.map((mapping) => (
                  <option key={mapping.csvColumn} value={mapping.csvColumn}>
                    {mapping.displayName}
                  </option>
                ))}
              </select>

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
                    opacity: importStatus === 'importing' || !csvStatusColumn || !columnMappings.some(m => m.selected) || !listName.trim() ? 0.5 : 1,
                  }}
                  onClick={executeImport}
                  disabled={importStatus === 'importing' || !csvStatusColumn || !columnMappings.some(m => m.selected) || !listName.trim()}
                >
                  {importStatus === 'importing'
                    ? 'Importing...'
                    : importStatus === 'success'
                    ? 'Done!'
                    : `Import ${csvData.length} investors`}
                </button>
              </div>

              {(!csvStatusColumn || !columnMappings.some(m => m.selected)) && (
                <p style={styles.warningText}>
                  {!csvStatusColumn ? 'Please select a status column.' : 'Please select at least one column to import.'}
                </p>
              )}
            </div>
          )}
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
    alignItems: 'flex-start',
    gap: '8px',
    transition: 'opacity 0.2s',
  },
  dragHandle: {
    color: '#5a5a6a',
    fontSize: '16px',
    cursor: 'move',
    lineHeight: '1',
    padding: '8px 4px',
    userSelect: 'none',
  } as React.CSSProperties,
  checkboxLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
    cursor: 'pointer',
    flex: 1,
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    marginTop: '8px',
    accentColor: '#6366f1',
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
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  columnNameInput: {
    width: '100%',
    color: '#e0e0e0',
    fontSize: '12px',
    fontFamily: "'JetBrains Mono', monospace",
    background: 'transparent',
    padding: '0',
    border: 'none',
    outline: 'none',
    cursor: 'text',
  },
  samplePreview: {
    color: '#6a6a7a',
    fontSize: '10px',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    display: 'block',
    width: '100%',
  },
  tooltipWrapper: {
    position: 'relative',
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: 'rgba(255, 255, 255, 0.05)',
    padding: '8px 10px',
    borderRadius: '4px',
  },
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '0',
    marginBottom: '8px',
    padding: '8px 12px',
    background: '#1a1a2e',
    border: '1px solid #3a3a4a',
    borderRadius: '6px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
    zIndex: 1000,
    minWidth: '150px',
    maxWidth: '250px',
    opacity: 0,
    visibility: 'hidden',
    transition: 'opacity 0.15s ease, visibility 0.15s ease',
    pointerEvents: 'none',
  },
  tooltipLabel: {
    color: '#8a8a9a',
    fontSize: '10px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '4px',
  },
  tooltipValue: {
    color: '#e0e0e0',
    fontSize: '12px',
    padding: '2px 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  mappingArrow: {
    color: '#5a5a6a',
    fontSize: '12px',
    paddingTop: '10px',
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
    alignSelf: 'flex-start',
  },
  warningText: {
    color: '#f97316',
    fontSize: '12px',
    marginTop: '12px',
    textAlign: 'center',
  },
};
