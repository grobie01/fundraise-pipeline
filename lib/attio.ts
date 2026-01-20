const ATTIO_API_URL = 'https://api.attio.com/v2';

export interface AttioListEntry {
  id: { entry_id: string };
  entry_values: Record<string, any>;
  parent_record_id?: string;
  parent_object?: string;
}

interface AttioList {
  id: { list_id: string };
  api_slug: string;
  name: string;
}

export interface AttioAttribute {
  id: { attribute_id: string };
  title: string;
  api_slug: string;
  type: string;
  is_archived: boolean;
}

export async function getAttioLists(): Promise<AttioList[]> {
  const response = await fetch(`${ATTIO_API_URL}/lists`, {
    headers: {
      'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Attio lists: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

export async function getAttioListEntries(listId: string): Promise<AttioListEntry[]> {
  const response = await fetch(`${ATTIO_API_URL}/lists/${listId}/entries/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Attio list entries: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data;
}

export async function getAttioListAttributes(listId: string): Promise<AttioAttribute[]> {
  const response = await fetch(`${ATTIO_API_URL}/lists/${listId}/attributes`, {
    headers: {
      'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Attio list attributes: ${response.statusText}`);
  }

  const data = await response.json();
  // Filter out archived attributes
  return data.data.filter((attr: AttioAttribute) => !attr.is_archived);
}

// Fetch record names for parent records
export async function getAttioRecordNames(
  records: { objectSlug: string; recordId: string }[]
): Promise<Record<string, string>> {
  if (records.length === 0) return {};

  const names: Record<string, string> = {};

  // Group by object type for efficient fetching
  const byObject: Record<string, string[]> = {};
  for (const { objectSlug, recordId } of records) {
    if (!byObject[objectSlug]) byObject[objectSlug] = [];
    if (!byObject[objectSlug].includes(recordId)) {
      byObject[objectSlug].push(recordId);
    }
  }

  // Fetch records by object type
  for (const [objectSlug, recordIds] of Object.entries(byObject)) {
    try {
      // Use the records query endpoint to fetch multiple records
      const response = await fetch(`${ATTIO_API_URL}/objects/${objectSlug}/records/query`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.ATTIO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: {
            record_id: { $in: recordIds },
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        for (const record of data.data || []) {
          const recordId = record.id?.record_id;
          // Try to get name from common fields
          const nameValue = record.values?.name?.[0]?.value ||
                           record.values?.company_name?.[0]?.value ||
                           record.values?.title?.[0]?.value;
          if (recordId && nameValue) {
            names[recordId] = nameValue;
          }
        }
      }
    } catch (err) {
      console.error(`Error fetching ${objectSlug} records:`, err);
    }
  }

  return names;
}

// Field mapping type - maps our app fields to Attio attribute slugs
export interface AttioFieldMapping {
  name: string | null;
  status: string | null;
  nextSteps: string | null;
  notes: string | null;
  amount: string | null;
  primaryContact: string | null;
  firmContact: string | null;
  fit: string | null;
  fundSize: string | null;
}

export function mapAttioEntryToInvestor(
  entry: AttioListEntry,
  fieldMapping: AttioFieldMapping,
  parentRecordNames: Record<string, string> = {}
): {
  name: string;
  status: string;
  next_steps: string;
  notes: string;
  amount: string;
  primary_contact: string;
  firm_contact: string;
  fit: number | null;
  fund_size: string;
} {
  const getValue = (attioSlug: string | null): string => {
    if (!attioSlug) return '';

    // Handle special __parent_record__ slug
    if (attioSlug === '__parent_record__') {
      if (entry.parent_record_id && parentRecordNames[entry.parent_record_id]) {
        return parentRecordNames[entry.parent_record_id];
      }
      return '';
    }

    const value = entry.entry_values[attioSlug];
    if (!value || value.length === 0) return '';

    // Handle different Attio field types
    const firstValue = value[0];

    // Text fields
    if (firstValue.value !== undefined) {
      return String(firstValue.value);
    }

    // Select fields
    if (firstValue.option?.title) {
      return firstValue.option.title;
    }

    // Status fields
    if (firstValue.status?.title) {
      return firstValue.status.title;
    }

    // Currency fields
    if (firstValue.currency_value !== undefined) {
      const amount = firstValue.currency_value;
      if (amount >= 1000000) {
        return `$${(amount / 1000000).toFixed(0)}M`;
      }
      return `$${amount.toLocaleString()}`;
    }

    // Linked record fields (like contacts)
    if (firstValue.target_record?.name) {
      return firstValue.target_record.name;
    }

    // User fields
    if (firstValue.referenced_actor?.name) {
      return firstValue.referenced_actor.name;
    }

    // Rating fields (numeric)
    if (typeof firstValue === 'number') {
      return String(firstValue);
    }

    return '';
  };

  const getNumericValue = (attioSlug: string | null): number | null => {
    if (!attioSlug) return null;
    const value = entry.entry_values[attioSlug];
    if (!value || value.length === 0) return null;

    const firstValue = value[0];
    if (firstValue.value !== undefined && typeof firstValue.value === 'number') {
      return firstValue.value;
    }
    // Handle rating type
    if (typeof firstValue === 'number') {
      return firstValue;
    }
    return null;
  };

  return {
    name: getValue(fieldMapping.name) || 'Unknown',
    status: mapStatusFromAttio(getValue(fieldMapping.status)),
    next_steps: getValue(fieldMapping.nextSteps),
    notes: getValue(fieldMapping.notes),
    amount: getValue(fieldMapping.amount),
    primary_contact: getValue(fieldMapping.primaryContact),
    firm_contact: getValue(fieldMapping.firmContact),
    fit: getNumericValue(fieldMapping.fit),
    fund_size: getValue(fieldMapping.fundSize),
  };
}

// Map Attio status values to our status types
function mapStatusFromAttio(attioStatus: string): string {
  const statusMap: Record<string, string> = {
    'lead': 'Lead',
    'first meeting': 'First Meeting',
    'first_meeting': 'First Meeting',
    'partner meeting': 'Partner Meeting',
    'partner_meeting': 'Partner Meeting',
    'term sheet': 'Term Sheet',
    'term_sheet': 'Term Sheet',
    'passed': 'Passed',
    'pass': 'Passed',
  };

  const normalized = attioStatus.toLowerCase().trim();
  return statusMap[normalized] || 'Lead';
}
