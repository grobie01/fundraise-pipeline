export type Status = 'Lead' | 'First Meeting' | 'Partner Meeting' | 'Term Sheet' | 'Passed';

export interface Investor {
  id: string;
  list_id: string;
  name: string;
  status: Status;
  next_steps: string;
  notes: string;
  amount: string;
  primary_contact: string;
  firm_contact: string;
  fit: number | null;
  fund_size: string;
  custom_fields: Record<string, any>;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface List {
  id: string;
  name: string;
  column_order: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface ListWithInvestors extends List {
  investors: Investor[];
}

// Frontend-friendly version (camelCase)
export interface InvestorUI {
  id: string;
  name: string;
  status: Status;
  nextSteps: string;
  notes: string;
  amount: string;
  primaryContact: string;
  firmContact: string;
  fit: number | null;
  fundSize: string;
  customFields: Record<string, any>;
}

// Convert DB format to UI format
export function toInvestorUI(investor: Investor): InvestorUI {
  return {
    id: investor.id,
    name: investor.name,
    status: investor.status,
    nextSteps: investor.next_steps,
    notes: investor.notes,
    amount: investor.amount,
    primaryContact: investor.primary_contact,
    firmContact: investor.firm_contact,
    fit: investor.fit,
    fundSize: investor.fund_size,
    customFields: investor.custom_fields || {},
  };
}

// Convert UI format to DB format (for updates)
export function toInvestorDB(investor: Partial<InvestorUI>): Partial<Investor> {
  const result: Partial<Investor> = {};
  if (investor.name !== undefined) result.name = investor.name;
  if (investor.status !== undefined) result.status = investor.status;
  if (investor.nextSteps !== undefined) result.next_steps = investor.nextSteps;
  if (investor.notes !== undefined) result.notes = investor.notes;
  if (investor.amount !== undefined) result.amount = investor.amount;
  if (investor.primaryContact !== undefined) result.primary_contact = investor.primaryContact;
  if (investor.firmContact !== undefined) result.firm_contact = investor.firmContact;
  if (investor.fit !== undefined) result.fit = investor.fit;
  if (investor.fundSize !== undefined) result.fund_size = investor.fundSize;
  return result;
}
