const ATTIO_API_URL = 'https://api.attio.com/v2';

interface AttioListEntry {
  id: { entry_id: string };
  values: Record<string, any>;
}

interface AttioList {
  id: { list_id: string };
  api_slug: string;
  name: string;
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

// Field mapping - customize this based on your Attio workspace setup
// The keys are our field names, values are Attio attribute slugs
const DEFAULT_FIELD_MAPPING = {
  name: 'company_name',      // or 'name' depending on your Attio setup
  status: 'status',
  nextSteps: 'next_steps',
  notes: 'notes',
  amount: 'check_size',
  primaryContact: 'primary_contact',
  firmContact: 'owner',
};

export function mapAttioEntryToInvestor(
  entry: AttioListEntry,
  fieldMapping = DEFAULT_FIELD_MAPPING
): {
  name: string;
  status: string;
  next_steps: string;
  notes: string;
  amount: string;
  primary_contact: string;
  firm_contact: string;
} {
  const getValue = (attioSlug: string): string => {
    const value = entry.values[attioSlug];
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

    return '';
  };

  return {
    name: getValue(fieldMapping.name) || 'Unknown',
    status: mapStatusFromAttio(getValue(fieldMapping.status)),
    next_steps: getValue(fieldMapping.nextSteps),
    notes: getValue(fieldMapping.notes),
    amount: getValue(fieldMapping.amount),
    primary_contact: getValue(fieldMapping.primaryContact),
    firm_contact: getValue(fieldMapping.firmContact),
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
