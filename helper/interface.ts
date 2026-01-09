export interface UploadedFile {
  name: string;
  size: number;
  type: string;
  rawFile: File;
}

export interface LeadData {
  id: string;
  company_name: string;
  website_url: string;
  funding_date: string;
  funding_amount: string;
  funding_round: string;
  linkedin_url: string;
  score: number;
  score_detail: string;
  decision_maker_data: string;
  decision_maker_linkedin: string;
  decision_maker_email: string;
  created_at: string;
}

export interface FormState {
  file: UploadedFile | null;
  webhookUrl: string;
  isLoading: boolean;
  isSubmitted: boolean;
  errors: {
    file?: string;
    webhookUrl?: string;
    submit?: string;
  };
  success: string;
}

export interface TableState {
  data: LeadData[];
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
}
