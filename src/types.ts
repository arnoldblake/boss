/**
 * Configuration interface for Ollama LLM service
 * @interface OllamaConfig
 * @property {string} host - The URL of the Ollama service
 * @property {string} model - The name of the LLM model to use
 */
export interface OllamaConfig {
    host: string;
    model: string;
}

/**
 * Response from Ollama tags API
 */
export interface OllamaTagsResponse {
    models: Array<{ name: string }>;
}

/**
 * Response from Ollama generate API
 */
export interface OllamaGenerateResponse {
    response: string;
}

/**
 * Options for Ollama generation request
 */
export interface OllamaGenerateOptions {
    temperature: number;
    num_predict: number;
    top_k: number;
    top_p: number;
    repeat_penalty: number;
    stop: string[];
}

/**
 * Request body for Ollama generate API
 */
export interface OllamaGenerateRequest {
    model: string;
    prompt: string;
    stream: boolean;
    options: OllamaGenerateOptions;
} 