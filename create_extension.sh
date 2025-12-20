#!/bin/bash
# TEXT MIND VS Code Extension - Starter Package Creator

echo "Creating TEXT MIND VS Code Extension Starter..."

# Create directory structure
mkdir -p src/{api,commands,views,services,utils}
mkdir -p media/screenshots
mkdir -p test/suite

# Mark as created
touch src/api/.created
touch src/commands/.created
touch src/views/.created
touch src/services/.created
touch src/utils/.created
touch media/.created
touch test/suite/.created

echo "✓ Directory structure created"
echo "✓ Total directories: $(find . -type d | wc -l)"
