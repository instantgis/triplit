FROM node:20-alpine AS build

WORKDIR /app

# Copy core workspace files, including Yarn release
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn

# Copy workspaces and shared config
COPY packages ./packages
COPY templates ./templates
COPY turbo.json ./turbo.json
COPY tsconfig.json ./tsconfig.json

# Install dependencies for the monorepo and focus the console workspace
RUN node .yarn/releases/yarn-4.2.2.cjs install --immutable
RUN node .yarn/releases/yarn-4.2.2.cjs workspaces focus @triplit/console --all

# Build the console SPA to dist/public
RUN node .yarn/releases/yarn-4.2.2.cjs workspace @triplit/console build:web

# Runtime image: nginx serving the static bundle
FROM nginx:1.27-alpine

# Copy built assets from the build stage
COPY --from=build /app/packages/console/dist/public /usr/share/nginx/html  

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
