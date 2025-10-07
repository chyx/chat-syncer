# Claude Code Instructions

## Git Workflow
- When user says "push", follow these steps in sequence:
  1. Check for uncommitted changes (git status)
  2. **IMPORTANT**: ALWAYS increment version number in ALL locations (even for small changes - required for Tampermonkey auto-update):
     - package.json (1 location)
     - src/chatgpt.js (1 location in version field)
     - **RULE**: Every push MUST have a version bump. Never push without incrementing version.
  3. Run `npm test` to verify functionality
  4. Run `npm run build` to generate chat-syncer-unified.js
  5. Commit all changes
  6. Push to remote

## Version Number Rules
- **ALWAYS** increment version before every push
- Even for debug logging, bug fixes, or documentation changes
- Version format: MAJOR.MINOR.PATCH (e.g., 1.7.4)
- Increment PATCH for bug fixes and small changes
- Increment MINOR for new features
- Check current version in package.json before incrementing

## Project Setup
- When first encountering a project, read README.md to understand the project structure and setup

## Instructions Recording
- When user says "记住", write the instruction to CLAUDE.md

## Testing Guidelines
- 不要用html测试，用能直接运行的js测试