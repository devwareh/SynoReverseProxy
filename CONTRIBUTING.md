# Contributing to Synology Reverse Proxy Manager

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](../../issues)
2. If not, create a new issue using the **Bug Report** template
3. Include as much detail as possible:
   - DSM version
   - Deployment method (Docker/bare metal)
   - Steps to reproduce
   - Expected vs actual behavior
   - Logs if applicable

### Suggesting Features

1. Check if the feature has already been requested
2. Create a new issue using the **Feature Request** template
3. Describe the use case and proposed solution

### Submitting Pull Requests

1. Fork the repository
2. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes following our coding standards
4. Write or update tests as needed
5. Ensure all tests pass:
   ```bash
   # Backend tests
   pytest tests/ -v
   
   # Frontend build
   cd frontend && npm run build
   ```
6. Commit with a descriptive message:
   ```bash
   git commit -m "feat: add new feature description"
   ```
7. Push and create a Pull Request

## Development Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- Docker (optional, for container testing)

### Backend Setup

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r backend/requirements.txt
pip install pytest pytest-cov ruff

# Run backend
cd backend
uvicorn app.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

### Running Tests

```bash
# Backend tests
pytest tests/ -v

# With coverage
pytest tests/ -v --cov=backend/app

# Security tests only
pytest tests/test_*security*.py -v
```

## Coding Standards

### Python (Backend)

- Follow PEP 8 style guide
- Use type hints for function arguments and return values
- Write docstrings for public functions and classes
- Run `ruff check backend/` before committing

### JavaScript (Frontend)

- Use functional components with hooks
- Follow React best practices
- Use meaningful variable and function names

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

### Pull Request Guidelines

- Keep PRs focused on a single feature or fix
- Update documentation if needed
- Add tests for new functionality
- Ensure CI passes before requesting review

## Security

If you discover a security vulnerability, please follow our [Security Policy](docs/SECURITY.md) for responsible disclosure. **Do not** open a public issue for security vulnerabilities.

## Questions?

Feel free to open a [Discussion](../../discussions) for questions or ideas that don't fit into issues.

## Release Process

We follow a continuous delivery model where:
- Commits to `main` trigger CI tests but do **not** publish Docker images.
- Releases are triggered by version tags (e.g., `v1.2.3`).

### Creating a Release

To create a new release, simply run the version bump script:

```bash
# For a patch release (bug fixes): 1.0.0 -> 1.0.1
./bump-version.sh patch

# For a minor release (new features): 1.0.0 -> 1.1.0
./bump-version.sh minor

# For a major release (breaking changes): 1.0.0 -> 2.0.0
./bump-version.sh major
```

The script will automatically:
1. Update version numbers in all required files
2. Create a git commit
3. Create a git tag
4. Push changes to GitHub (after confirmation)

This triggers the **Docker Publish** workflow which builds and pushes images to GHCR and creates a GitHub Release.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
