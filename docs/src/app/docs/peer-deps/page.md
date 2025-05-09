---
title: Peer Dependencies and Tree-Shaking
nextjs:
  metadata:
    title: Peer Dependencies and Tree-Shaking
    description: Understanding how build-ai's peer dependencies work with tree-shaking
---

## Package Structure

build-ai is designed as a modular library with multiple entry points, each optimized for different use cases:

- Core functionality (`build-ai`)
- React components and hooks (`build-ai/react`)
- UI components (`build-ai/ui`)
- Streaming utilities (`build-ai/stream`)

## Peer Dependencies

build-ai uses peer dependencies to ensure compatibility with your existing project setup while avoiding duplicate dependencies. The library declares these peer dependencies:

```txt
react: >=16.8.0 <20.0.0
react-dom: >=16.8.0 <20.0.0
solid-js: >=1.9.5
lit: >=3.3.0
animejs: >=4.0.1
@floating-ui/dom: >=1.6.13
```

### How Peer Dependencies Work

When you use build-ai in your project:

1. You only need to install the peer dependencies that you actually use
2. If you're using React components, you don't need to install Solid.js or Lit
3. The library will use your project's versions of these dependencies

## Tree-Shaking Benefits

build-ai is built with tree-shaking in mind. This means:

- Only the code you actually use gets included in your final bundle
- If you only use React components, none of the Solid.js or Lit code will be included
- Even within a module, unused features are automatically removed

### Example Scenarios

1. **React-only Project**
   - Only React and React DOM are needed as peer dependencies
   - Solid.js, Lit, and other framework code is completely excluded
   - Your bundle only includes the React-specific code you use

2. **Mixed Framework Project**
   - You can use both React and Solid.js components
   - Each framework's code is only included when you use it
   - No duplicate framework code in your bundle

3. **Minimal Usage**
   - If you only use one component, only that component and its dependencies are included
   - The rest of the library is automatically removed during build

This architecture ensures you only pay for what you use, both in terms of bundle size and dependencies.
