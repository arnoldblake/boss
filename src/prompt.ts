/**
 * Generates a prompt for code completion using the provided context
 * @param languageId The programming language ID
 * @param precedingText Previous lines of code for context
 * @param currentLine The current line being completed
 * @returns Formatted prompt string for the LLM
 */
export function generateCompletionPrompt(
    languageId: string,
    precedingText: string,
    currentLine: string
): string {
    return `[INST]You are an expert code completion assistant. Given this ${languageId} code:

${precedingText}
${currentLine}

Complete this line of code to the best of your ability. Output a complete syntatically correct line of code.
Only output the completion, no explanations.[/INST]`;
} 