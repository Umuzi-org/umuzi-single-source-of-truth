import { query } from "../db";
import type { QuestionAsked, CreateQuestionAsked } from "../db-types";

// Insert a new question record
export async function insertQuestion(
  data: CreateQuestionAsked,
): Promise<QuestionAsked> {
  const { user_id, question_text } = data;

  const result = await query<QuestionAsked>(
    `INSERT INTO questions_asked (user_id, question_text)
     VALUES ($1, $2)
     RETURNING *`,
    [user_id, question_text],
  );

  return result.rows[0];
}

// Find a question by ID
export async function findQuestionById(
  id: number,
): Promise<QuestionAsked | null> {
  const result = await query<QuestionAsked>(
    "SELECT * FROM questions_asked WHERE id = $1",
    [id],
  );

  return result.rows[0] || null;
}

// Get questions by user ID with pagination
export async function getQuestionsByUserId(
  userId: string,
  limit: number = 50,
  offset: number = 0,
): Promise<QuestionAsked[]> {
  const result = await query<QuestionAsked>(
    `SELECT * FROM questions_asked 
     WHERE user_id = $1 
     ORDER BY timestamp DESC 
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset],
  );

  return result.rows;
}

// Get recent questions across all users with pagination
export async function getRecentQuestions(
  limit: number = 50,
  offset: number = 0,
): Promise<QuestionAsked[]> {
  const result = await query<QuestionAsked>(
    "SELECT * FROM questions_asked ORDER BY timestamp DESC LIMIT $1 OFFSET $2",
    [limit, offset],
  );

  return result.rows;
}

// Count total questions asked by a user
export async function countQuestionsByUser(userId: string): Promise<number> {
  const result = await query<{ count: string }>(
    "SELECT COUNT(*) as count FROM questions_asked WHERE user_id = $1",
    [userId],
  );

  return parseInt(result.rows[0].count, 10);
}

// Delete a question by ID (useful when offboarding users from slack or general data cleanup)
export async function deleteQuestion(id: number): Promise<boolean> {
  const result = await query("DELETE FROM questions_asked WHERE id = $1", [id]);

  return (result.rowCount ?? 0) > 0;
}
