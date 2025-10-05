# Claude Code Instructions

## Git Workflow
- When user says "push", follow these steps in sequence:
  1. Check for uncommitted changes (git status)
  2. Confirm version number has been incremented in ALL locations:
     - package.json (1 location)
     - src/chatgpt.js (2 locations in meta.version fields)
  3. Run `npm test` to verify functionality
  4. Run `npm run build` to generate chat-syncer-unified.js
  5. Commit all changes
  6. Push to remote

## Project Setup
- When first encountering a project, read README.md to understand the project structure and setup

## Instructions Recording
- When user says "记住", write the instruction to CLAUDE.md

## Testing Guidelines
- 不要用html测试，用能直接运行的js测试