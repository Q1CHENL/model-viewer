# GitHub Copilot Instructions

This file provides instructions and context for GitHub Copilot and other AI coding assistants working on this project.

## Project Overview

This is a 3D model viewer application built with TypeScript, Three.js, and ThatOpen Components. It provides advanced features for viewing and manipulating GLB/GLTF 3D models, including:

- Interactive 3D model viewing with camera controls
- Mesh batching for performance optimization
- Edge detection and visualization
- Adaptive resolution rendering
- Object selection and highlighting
- Clipping plane functionality
- Culling optimizations

## Architecture

### Core Components
- **Viewer**: Main viewer class managing the 3D scene and rendering
- **Controllers**: Specialized controllers for different features (selection, clipping, culling, etc.)
- **Batching**: Performance optimization system for combining meshes
- **Adaptive Resolution**: Dynamic quality adjustment based on performance

### Key Dependencies
- **Three.js**: 3D graphics library
- **@thatopen/components**: Building Information Modeling (BIM) components
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and development server

## Coding Guidelines

### General Principles
1. **Minimal Changes**: Make the smallest possible changes to achieve the goal
2. **Type Safety**: Utilize TypeScript features for type safety and better IntelliSense
3. **Performance First**: Always consider performance implications, especially for 3D rendering
4. **Clean Architecture**: Maintain separation of concerns between controllers and the main viewer

### Code Style
- Use TypeScript interfaces for type definitions
- Prefer composition over inheritance
- Use descriptive variable and function names
- Follow existing naming conventions (camelCase for variables/functions, PascalCase for classes)
- Keep functions focused and single-purpose

### Three.js Specific Guidelines
- Always dispose of geometries, materials, and textures when no longer needed
- Use object pooling for frequently created/destroyed objects
- Prefer instanced rendering for repeated geometry
- Be mindful of draw calls and batch similar objects

### Performance Considerations
- The batching system is critical for performance - avoid breaking merged meshes
- Use the adaptive resolution controller for performance-sensitive operations
- Implement proper culling to avoid unnecessary rendering
- Cache expensive operations (geometry processing, material creation)

## File Structure

```
src/
├── viewer/
│   └── Viewer.ts          # Main viewer class
├── batching.ts            # Mesh batching utilities
├── clipping.ts            # Clipping plane functionality
├── selection.ts           # Object selection system
├── highlight.ts           # Object highlighting
├── culling.ts             # Performance culling
├── adaptiveRes.ts         # Adaptive resolution
└── main.ts                # Application entry point
```

## Common Tasks

### Adding New Features
1. Create a dedicated controller class if the feature is complex
2. Integrate with the main Viewer class through composition
3. Add UI controls in the HTML/main.ts as needed
4. Consider performance implications for 3D rendering

### Working with 3D Objects
- All user models should have `userData.isUserModel = true`
- Use the batching system when possible for performance
- Implement proper disposal patterns for Three.js objects
- Consider the impact on existing features (selection, highlighting, clipping)

### Performance Optimization
- Profile before optimizing
- Use the browser's performance tools
- Consider GPU vs CPU workload balance
- Test with large models to ensure scalability

## Testing Guidelines

### Manual Testing
- Test with various GLB/GLTF models of different sizes
- Verify performance with large models (>10MB)
- Test all UI controls and features
- Check memory usage and dispose patterns
- Test on different devices/browsers for compatibility

### Areas to Focus On
- Model loading and parsing
- Batching system functionality
- Selection and highlighting accuracy
- Clipping plane behavior
- Adaptive resolution effectiveness
- Memory management and disposal

## Integration Points

### UI Integration
- The main UI is in `index.html` with inline styles
- Event handlers are set up in `main.ts`
- Stats panel updates are handled through the viewer's event system

### External Dependencies
- ThatOpen Components for advanced BIM features
- Three.js for core 3D functionality
- Vite for development and building

## AI Assistance Guidelines

### Before Making Changes
1. **Wait for Explicit Confirmation**: Do not start implementing unless explicitly instructed
2. **Understand the Architecture**: Review existing code structure and patterns
3. **Assess Impact**: Consider effects on performance, especially 3D operations
4. **Maintain Type Safety**: Preserve existing interfaces and TypeScript patterns
5. **Plan Minimal Changes**: Target only the specific requested area

### Code Review Focus
- Type safety and interface consistency
- Performance implications for 3D rendering
- Proper Three.js resource management
- Integration with existing systems (batching, selection, etc.)
- UI/UX consistency and existing styling

### Common Pitfalls to Avoid
- Breaking the batching system by modifying merged meshes
- Creating memory leaks by not disposing Three.js objects
- Ignoring the adaptive resolution system for performance-heavy operations
- Modifying core Three.js objects without considering side effects
- Making assumptions about requirements - ask for clarification when unclear

### Development Workflow
1. Explore and understand the codebase first
2. Present a TODO list for complex tasks
3. Make small, incremental changes
4. Test thoroughly with actual 3D models
5. Run lint checks and builds after changes
6. Provide clear testing instructions

## Development Setup

```bash
npm install
npm run dev    # Development server
npm run build  # Production build
```

The application runs on `http://localhost:5173/` in development mode.