# Frontend - Synology Reverse Proxy Manager

React frontend application for managing Synology reverse proxy rules.

## Quick Start

See the main [README.md](../README.md) for complete setup instructions.

### Development

```bash
# Install dependencies
npm install

# Start development server
npm start
```

The app will be available at `http://localhost:3000`

### Production Build

```bash
# Build for production
npm run build
```

The build output will be in the `build/` directory, ready to be served by nginx (see Dockerfile).

## Project Structure

- `src/` - React source code
  - `components/` - React components
  - `contexts/` - React contexts (AuthContext)
  - `hooks/` - Custom React hooks
  - `utils/` - Utility functions (API client, constants)
- `public/` - Static assets
- `build/` - Production build output (generated, gitignored)

## Key Features

- Modern React UI with responsive design
- Authentication with session management
- Full CRUD operations for reverse proxy rules
- Search and filter functionality
- Real-time updates after operations

For detailed documentation, see the main [README.md](../README.md).
