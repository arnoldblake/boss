// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { generateCompletionPrompt } from './prompt';
import { 
	OllamaConfig, 
	OllamaTagsResponse, 
	OllamaGenerateResponse,
	OllamaGenerateRequest 
} from './types';

/**
 * Provides AI-powered inline code completions using the Ollama LLM service.
 * This provider implements VS Code's InlineCompletionItemProvider interface to offer
 * real-time code suggestions as users type.
 */
class LLMInlineCompletionProvider implements vscode.InlineCompletionItemProvider {
	private config: OllamaConfig;
	private statusBarItem: vscode.StatusBarItem;
	private outputChannel: vscode.OutputChannel;
	private debounceTimer: NodeJS.Timeout | undefined;
	private lastPosition: vscode.Position | undefined;
	private readonly debounceDelay = 500; // Delay in ms before triggering completion

	/**
	 * Creates a new instance of the completion provider
	 * @param {OllamaConfig} config - Configuration for the Ollama service
	 */
	constructor(config: OllamaConfig) {
		this.config = config;
		this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
		this.statusBarItem.show();
		this.updateStatusBar('starting...');
		this.outputChannel = vscode.window.createOutputChannel('Boss');
	}

	/**
	 * Logs messages to the extension's output channel with timestamps
	 * @param {string} message - The message to log
	 */
	private log(message: string) {
		this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
	}

	/**
	 * Updates the VS Code status bar with the current state of the extension
	 * @param {string} status - The status message to display
	 */
	private updateStatusBar(status: string) {
		this.statusBarItem.text = `$(sparkle) Boss: ${status}`;
		this.statusBarItem.tooltip = `Using model: ${this.config.model}`;
	}

	/**
	 * Checks if the Ollama service is running and the specified model is available
	 * @returns {Promise<boolean>} True if the service and model are available
	 */
	public async checkOllamaStatus(): Promise<boolean> {
		try {
			this.updateStatusBar('checking...');
			const response = await fetch(`${this.config.host}/api/tags`);
			if (!response.ok) {
				throw new Error('Ollama service not available');
			}
			const data = await response.json() as OllamaTagsResponse;
			const modelExists = data.models?.some((m: { name: string }) => m.name === this.config.model);
			
			if (!modelExists) {
				this.updateStatusBar('model not found');
				vscode.window.showErrorMessage(
					`Model ${this.config.model} not found. Please run: ollama pull ${this.config.model}`
				);
				return false;
			}
			this.updateStatusBar('ready');
			return true;
		} catch (error) {
			this.updateStatusBar('offline');
			vscode.window.showErrorMessage(
				`Ollama service not available at ${this.config.host}. Please make sure Ollama is running.`
			);
			return false;
		}
	}

	/**
	 * Provides inline completion items based on the current cursor position and context
	 * This method is called by VS Code when inline completions are requested.
	 * It implements debouncing to prevent too frequent API calls and includes
	 * context-aware completion generation.
	 * 
	 * @param {vscode.TextDocument} document - The current text document
	 * @param {vscode.Position} position - The position where completion was requested
	 * @param {vscode.InlineCompletionContext} context - Additional context information
	 * @param {vscode.CancellationToken} token - Token to cancel the operation
	 * @returns {Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null | undefined>}
	 */
	async provideInlineCompletionItems(
		document: vscode.TextDocument,
		position: vscode.Position,
		context: vscode.InlineCompletionContext,
		token: vscode.CancellationToken
	): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | null | undefined> {
		// Get the current line text and check if we have enough characters
		const lineText = document.lineAt(position.line).text;
		
		// Only proceed if we have at least 5 non-whitespace characters
		if (lineText.length < 5) {
			return undefined;
		}

		// Return a promise that resolves after the debounce delay
		return new Promise((resolve) => {
			// Clear any existing timer
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}

			// If the position hasn't changed, don't create a new timer
			if (this.lastPosition && 
				this.lastPosition.line === position.line && 
				this.lastPosition.character === position.character) {
				resolve(undefined);
				return;
			}

			// Store the current position
			this.lastPosition = position;

			// Create a new timer
			this.debounceTimer = setTimeout(async () => {
				try {
					// Check if the token is still valid
					if (token.isCancellationRequested) {
						resolve(undefined);
						return;
					}

					// Check Ollama status before making completion request
					const isOllamaReady = await this.checkOllamaStatus();
					if (!isOllamaReady) {
						resolve(undefined);
						return;
					}

					this.updateStatusBar('generating...');
					
					const textAfterCursor = lineText.substring(position.character);

					// Get some context from surrounding lines (up to 10 lines before and after)
					const startLine = Math.max(0, position.line - 10);
					const endLine = Math.min(document.lineCount - 1, position.line + 10);
					const contextLines = [];
					
					// Get preceding lines
					for (let i = startLine; i < position.line; i++) {
						contextLines.push(document.lineAt(i).text);
					}
					const precedingText = contextLines.join('\n');

					// Get following lines
					const followingLines = [];
					for (let i = position.line + 1; i <= endLine; i++) {
						followingLines.push(document.lineAt(i).text);
					}
					const followingText = followingLines.join('\n');

					// Get the language ID for better context
					const languageId = document.languageId;

					const prompt = generateCompletionPrompt(
						languageId,
						precedingText,
						lineText,
						followingText
					);

					this.log(`Generating completion for language: ${languageId}`);
					this.log(`Context:\n${precedingText}`);
					this.log(`Current line: ${lineText}|cursor|${textAfterCursor}`);

					const response = await fetch(`${this.config.host}/api/generate`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
						},
						body: JSON.stringify({
							model: this.config.model,
							prompt,
							stream: false,
							options: {
								temperature: 0.1,
								num_predict: 64,
								top_k: 40,
								top_p: 0.9,
								repeat_penalty: 1.1,
								stop: ["\n", "[/INST]", "[INST]"]

							}
						} as OllamaGenerateRequest)
					});

					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(`Ollama API error: ${response.statusText}. ${errorText}`);
					}

					const data = await response.json() as OllamaGenerateResponse;
					const suggestion = data.response;

					// Log the raw suggestion
					this.log(`Raw suggestion: ${suggestion}`);

					if (suggestion) {
						const range = new vscode.Range(
							position.line, 0,
							position.line, suggestion.length
						);
						resolve([new vscode.InlineCompletionItem(suggestion, range)]);

					}
					this.updateStatusBar('ready');
					resolve(undefined);
				} catch (error: unknown) {
					console.error('Error getting completion:', error);
					const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
					vscode.window.showErrorMessage(`Ollama completion error: ${errorMessage}`);
					this.log(`Error: ${errorMessage}`);
					this.updateStatusBar('error');
					resolve(undefined);
				}
			}, this.debounceDelay);
		});
	}

	/**
	 * Cleans up resources when the extension is deactivated
	 */
	public dispose() {
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.statusBarItem.dispose();
		this.outputChannel.dispose();
	}
}

/**
 * Activates the Boss extension
 * This is the main entry point of the extension, called by VS Code when the extension
 * is first activated (usually when a file is opened). It sets up the completion provider,
 * registers it with VS Code, and initializes configuration watchers.
 * 
 * @param {vscode.ExtensionContext} context - The context provided by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
	console.log('Activating Boss extension...');

	// Get Ollama configuration
	const config = vscode.workspace.getConfiguration('boss');
	const ollamaConfig: OllamaConfig = {
		host: config.get<string>('ollamaHost') ?? 'http://localhost:11434',
		model: config.get<string>('ollamaModel') ?? 'deepseek-r1:1.5b'
	};

	// Create provider instance
	const provider = new LLMInlineCompletionProvider(ollamaConfig);
	
	// Initial status check
	await provider.checkOllamaStatus();

	// Register the inline completion provider
	const disposable = vscode.languages.registerInlineCompletionItemProvider(
		{ pattern: '**' }, // Register for all file types
		provider
	);

	context.subscriptions.push(disposable);
	context.subscriptions.push(provider); // Ensure the provider is disposed properly

	// Watch for configuration changes
	context.subscriptions.push(
		vscode.workspace.onDidChangeConfiguration(async e => {
			if (e.affectsConfiguration('boss.ollamaHost') || e.affectsConfiguration('boss.ollamaModel')) {
				const newConfig = vscode.workspace.getConfiguration('boss');
				ollamaConfig.host = newConfig.get<string>('ollamaHost') ?? 'http://localhost:11434';
				ollamaConfig.model = newConfig.get<string>('ollamaModel') ?? 'deepseek-r1:1.5b';
				// Check status when configuration changes
				await provider.checkOllamaStatus();
			}
		})
	);
}

/**
 * Called when the extension is deactivated
 * Currently no cleanup is needed, but this function is required by VS Code
 */
export function deactivate() {}
