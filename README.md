# boss README

Selfhosted AI tab completion using Ollama. Boss can provide AI generated tab autocompletion using your selfhosted Ollama instance.

## Features

- AI-powered inline code completions using Ollama
- Configurable Ollama host and model
- Status bar indicator for Ollama service status
- Output channel for logging and debugging
- Context-aware completions
- Debounce mechanism to prevent excessive requests

## Requirements

- Ollama installed and running on your machine
- VS Code or compatible fork installed on your machine

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `myExtension.enable`: Enable/disable this extension.
- `myExtension.thing`: Set to `blah` to do something.

## Debugging

cmd+shift+p -> Show Output Windows -> boss

## Known Issues

This is still a prototype and has some issues.

## Release Notes

### 0.0.1

Proof of concept completed using Ollama and llama3.2:3b.
