# CloudNux

Multi-cloud provider abstraction framework

## Overview

CloudNux is a multi-cloud provider abstraction framework that allows you to interact with different cloud providers through a unified interface.

## Development Workflow

### Prerequisites

- Node.js >= 22.0.0
- Yarn >= 1.22.0

### Installation

```bash
yarn install
```

### Development Commands

```bash
# Build all packages
yarn build

# Run development mode (CLI)
yarn dev

# Run tests
yarn test

# Lint code
yarn lint
yarn lint:fix

# Type checking
yarn type-check

# Clean build artifacts
yarn clean

# Clean everything including node_modules
yarn clean:all
```

### Workspace Commands

Work with specific packages using these shortcuts:

```bash
yarn cli      # @cloudnux/cli
yarn core     # @cloudnux/core-cloud-provider
yarn web      # @cloudnux/dev-console
yarn local    # @cloudnux/local-cloud-provider
yarn aws      # @cloudnux/aws-cloud-provider
yarn utils    # @cloudnux/utils
```

## Release Workflow

This project uses [Changesets](https://github.com/changesets/changesets) for version management and automated releases.

### Step 1: Making Changes

1. Create a new branch for your changes
2. Make your code changes
3. Ensure tests pass and code is linted

### Step 2: Adding a Changeset

When you've made changes that should be released, create a changeset:

```bash
yarn changeset
```

This will:
- Prompt you to select which packages have changed
- Ask you to specify the type of change (major, minor, patch)
- Request a description of the changes

The command creates a markdown file in the `.changeset/` directory. Commit this file along with your changes.

### Step 3: Creating a Pull Request

1. Commit your changes and the changeset file
2. Push to your branch
3. Create a pull request to the `main` branch

### Step 4: Automated Release Process

Once your PR is merged to `main`, the CI/CD pipeline automatically handles the release:

#### CI/CD Pipeline Flow

1. **Build Job**
   - Runs linting, type checking, and builds all packages
   - Ensures code quality before proceeding

2. **Publish Job** (only on `main` branch)
   - Checks for changeset files in `.changeset/` directory
   - If changesets exist:
     - Runs `yarn changeset:version` to:
       - Update package versions in `package.json` files
       - Update `CHANGELOG.md` files
       - Create Git tags for new versions
       - Commit these changes with message: `"chore: version packages [skip ci]"`
     - Runs `yarn changeset:publish` to publish packages to NPM
   - If no changesets exist, skips versioning and publishing

3. **Release Job** (only on `main` branch, after publish)
   - Gets the latest Git tag (created by the publish job)
   - If a tag exists:
     - Creates a GitHub Release with the tag
     - Links to the CHANGELOG.md for details
   - If no tag exists, skips GitHub Release creation

#### What Gets Created

When the pipeline runs successfully with changesets:

- **Updated versions**: Package versions are bumped according to changeset specifications
- **Git tags**: Tags are created in format `@package-name@version` (e.g., `@cloudnux/cli@1.2.0`)
- **NPM packages**: New versions are published to NPM registry
- **GitHub Release**: A release is created on GitHub with changelog details
- **Updated CHANGELOG.md**: Changelogs are automatically updated with new entries

### Manual Publishing (Not Recommended)

If you need to manually publish (for testing or special cases):

```bash
# Build and publish all packages
yarn publish-packages

# Or step by step:
yarn build
yarn changeset:version  # Updates versions and creates tags
yarn changeset:publish  # Publishes to NPM
```

## Important Notes

### Changesets

- Always create a changeset for user-facing changes
- Internal refactoring or CI changes may not need a changeset
- Multiple changesets can exist before a release - they'll all be combined

### Git Tags

- Git tags are automatically created by the `changeset:version` command
- Tags follow the format: `@package-name@version`
- The release job uses these tags to create GitHub Releases
- You don't need to manually create tags

### Branch Strategy

- `main`: Production branch, triggers CI/CD pipeline on push
- Feature branches: Create from `main`, merge via pull request
- The `[skip ci]` tag in version commits prevents infinite CI loops

### First Release

If this is your first release and no tags exist yet:
1. Create your first changeset with `yarn changeset`
2. Merge to `main`
3. The pipeline will create the first tag and publish
4. Subsequent releases will automatically reference previous tags

## License

MIT

## Author

Mina W Alphonce
