#!/bin/bash

# CloudNux Publishing Script
# This script handles the publishing process for all packages

set -e

echo "🚀 CloudNux Publishing Script"
echo "=============================="

# Check if we're on the main branch
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "❌ Error: Must be on main branch to publish. Currently on: $CURRENT_BRANCH"
    exit 1
fi

# Check if working directory is clean
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: Working directory is not clean. Please commit or stash changes."
    exit 1
fi

# Check if NPM_TOKEN is set
if [ -z "$NPM_TOKEN" ]; then
    echo "❌ Error: NPM_TOKEN environment variable is not set"
    echo "Please set your npm token: export NPM_TOKEN=your_token_here"
    exit 1
fi

# Setup npm authentication
echo "🔑 Setting up npm authentication..."
echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > ~/.npmrc

# Install dependencies
echo "📦 Installing dependencies..."
yarn install --frozen-lockfile

# Clean previous builds
echo "🧹 Cleaning previous builds..."
yarn clean

# Run full build pipeline
echo "🔨 Building packages..."
yarn build

# Run tests
echo "🧪 Running tests..."
yarn test

# Run linting
echo "🔍 Running linting..."
yarn lint

# Type checking
echo "📝 Type checking..."
yarn type-check

# Check for changesets
echo "📋 Checking for changesets..."
if [ ! -d ".changeset" ] || [ -z "$(find .changeset -name '*.md' -not -name 'README.md' -not -name 'config.json')" ]; then
    echo "❌ Error: No changesets found. Please run 'yarn changeset' to create a changeset."
    exit 1
fi

# Version packages
echo "📈 Versioning packages..."
yarn changeset:version

# Commit version changes
if [ -n "$(git status --porcelain)" ]; then
    echo "💾 Committing version changes..."
    git add .
    git commit -m "chore: version packages"
    git push origin main
fi

# Publish packages
echo "🚀 Publishing packages..."
yarn changeset:publish

# Push tags
echo "🏷️  Pushing tags..."
git push --follow-tags

echo "✅ Publishing completed successfully!"
echo ""
echo "📊 Published packages:"
yarn changeset status --verbose

# Clean up
rm -f ~/.npmrc