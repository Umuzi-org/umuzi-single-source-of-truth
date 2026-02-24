export interface CategoryBreakdown {
  name: string;
  count: number;
  percentage: number;
}

export interface MostAskedQuestion {
  question: string;
  count: number;
}

export interface MonthlyReport {
  totalQuestions: number;
  categories: CategoryBreakdown[];
  mostAsked: MostAskedQuestion;
  observations: string[];
  suggestions: string[];
}
