# CLAUDE.md

## Project Overview
Plugin for Stash to enhance gay experience by hiding female performers and replacing female-only tags.

## Coding Standards & Guidelines

### 1. General Principles
- Write clean, readable, and maintainable code
- Follow the principle of **least surprise**
- Prefer explicit over implicit
- Keep functions small and focused (single responsibility)
- Use meaningful variable and function names

### 2. Code Style
- **Indentation**: 2 spaces (or 4 spaces — be consistent)
- **Line length**: Maximum 100 characters
- **Comments**: 
  - Write comments for complex logic
  - Use JSDoc / TSDoc / Python docstrings for functions and classes
  - Avoid obvious comments

### 3. Architecture & Patterns
- Follow **SOLID** principles where applicable
- Use dependency injection when it improves testability
- Prefer composition over inheritance
- Keep business logic separate from UI/infrastructure

### 4. Versioning
- Bug fixes always end up in a minor version update (+0.0.1), +0.1.0 and +1.0.0 updates are reserved for medium and major feature updates, respectively, which always require user approval.
- Use Vienna time zone (switch to summer time as appropriate) to create time stamps
- When doen with your chnages prepare the plugin package (zip) and commit to git with an appropriate commit message

### 4. Testing
- Write tests for all new features and bug fixes
- Aim for high test coverage on critical paths
- Use meaningful test names (`should_do_X_when_Y`)
- Prefer integration tests over mocking everything
- store tests in a dedicated tests/ directory

### 5. Error Handling
- Fail fast and loud in development
- Provide clear, actionable error messages
- Use proper error types/exceptions
- Never swallow errors silently

### 6. Performance
- Write readable code first, optimize only when necessary
- Be mindful of algorithmic complexity (Big O)
- Profile before optimizing

## Technology Stack
- **Language**: 
- **Framework**:
- **Database**:
- **Other tools**:

## Folder Structure

Use Vienna time zone (switch to summer time as appropriate) to create time stamps

Bug fixes always end up in a minor version update (+0.0.1), +0.1.0 and +1.0.0 updates are reserved for medium and major feature updates, respectively.
