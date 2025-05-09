
[![CircleCI](https://dl.circleci.com/status-badge/img/gh/Pascal-Lohscheidt/build-ai/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/Pascal-Lohscheidt/build-ai/tree/main)

# build-ai - Contributor README

The readme of the package is available [here](https://github.com/Pascal-Lohscheidt/build-ai/package/README.md).

A powerful TypeScript library for building AI-driven web applications. This package provides both general utilities (`build-ai`) and visual components (`build-ai/visual`).

# Roadmap

### Upcoming
 - [ ] publish documentation side on vercel
 - [ ] release v1
 - [ ] react hooks: useChatConversation, useVoiceConversation, usePrompt
 - [ ] Make Pump usable for 2 specific use cases.
 - [ ] add stable visuals
 - [ ] Add an example 
 - [ ] Add a changelog

 ---- 
### Goals down the line
 - [ ] SolidJs support - https://stepsailor.com heavily uses solidjs for its AI features
 - [ ] Add github project for better project management
 - [ ] Add issue support for better bug tracking
 - [ ] Add contributing guide
 - [ ] MCP Support - the React of the MCP world
 - [ ] Plugin system. I would like people to be able to create Plugins for different section of the library and publish them in here as core package as a contributor. -> Inspired by [BetterAuth](https://www.better-auth.com/)
 

# Principles
  - Make product developers lives easier to implement AI features
  - DX First
  - Typescript first
  - Treeshaking friendly - You get what you need, nothing more, nothing less
  - API as readable as possible. What you read is what you get.
  - Agnostic. No vendor lock-in. Adapters... Adapters... Adapters...
  - Made with the brain of a product developer profcient in typescript - not half baked SDK with unstable types.




## Contributing - TBD

We welcome contributions! Please follow these guidelines:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following our commit conventions (see below)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/) for our commit messages. This helps us maintain a clean and consistent git history.

Format:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Types:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

Example:
```
feat(auth): add OAuth2 authentication

- Add Google OAuth2 provider
- Implement token refresh flow
- Add user profile endpoint

Closes #123
```

## License

MIT - Beware that this does not cover the /docs folder, since it is using a Tailwind Template.

---

Created by the makers of [Stepsailor](https://stepsailor.com) (Pascal Lohscheidt) 