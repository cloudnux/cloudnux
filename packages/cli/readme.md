# EntryPoint Framework CLI

A task-based CLI framework for managing cloud function deployments and local development.

## Configuration

Create an 

`epf.config.js` or `.epfrc.js` in your project root:

```typescript
export default {
  // Path to modules containing entrypoint.json files
  modulesPath: './packages/modules/**/entrypoint.json',
  
  // Cloud provider: 'aws', 'azure', or 'gcp'
  cloudProvider: 'aws',
  
  // Build output directory
  workingDir: './.epf',
  
  // Environment configurations
  environments: {
    develop: {
      // Development environment tasks
      tasks: [],
      // Optional watch task for development
      watch: {
        title: "Dev Server",
        action: async () => {
          // Development server logic
        }
      }
    },
    prod: {
      // Production deployment tasks 
      tasks: []
    }
  }
}
```

## Task System

Tasks are the core building blocks of EPF workflows. Each task has:

```typescript
{
  // Task display name or function returning name
  title: string | ((params) => string),
  
  // Optional skip condition
  skip?: (params) => boolean,
  
  // Main task action
  action: (params, executeSubTasks?) => Promise<any>,
  
  // Optional subtasks
  children?: Task[]
}
```

## CLI Usage

```bash
# Run with environment
epf <environment>

# Specify config file
epf <environment> --config=./custom-config.js
```

## Environments

Each environment (

develop

, 

prod

, etc) can define:

- 

tasks

: Array of tasks to execute
- 

watch

: Optional development server task
- Custom environment parameters

## Development Mode

The 

watch

 task enables development mode with:

- Real-time logs
- Local development server
- Hot reload capability
- Process runs until terminated

## Task Parameters

Tasks receive parameters including:

```typescript
{
  modulesPath: string,    // Path to modules
  cloudProvider: string,  // Selected cloud provider
  workingDir: string,    // Build output directory
  environment: string,   // Current environment name
  // ...environment specific params
}
```

## Project Structure

```
.
├── epf.config.js           # CLI configuration
├── packages/
│   └── modules/           # Function modules
│       └── */
│           └── entrypoint.json  # Module definition
└── .epf/                  # Build artifacts
    └── <environment>/     # Environment builds
```

This CLI provides a structured way to manage cloud function development and deployment workflows across different environments and cloud providers.