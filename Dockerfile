# syntax=docker/dockerfile:1.7

############################
# Stage 1: Build Angular client
############################
FROM node:22-bookworm-slim AS client-build

WORKDIR /app

# Install client dependencies (using lockfile for reproducible builds)
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci

# Copy client sources and build
COPY client ./client
WORKDIR /app/client
RUN npm run build

############################
# Stage 2: Install server deps
############################
FROM node:22-bookworm-slim AS server-build

WORKDIR /app

# Ensure native modules are built from source inside the container
# Rely on the target platform provided by BuildKit/Buildx; do not override arch/platform via npm env
ENV npm_config_build_from_source=1

# Copy server sources early and ensure no host node_modules leak in
COPY server ./server
RUN rm -rf server/node_modules

# Install server production dependencies (build from source) inside container
# Force building native modules from source to avoid wrong-arch prebuilds
RUN cd server && npm ci

# Copy built Angular app into the place the server expects
# (adjust path if your server serves a different directory)
COPY --from=client-build /app/client/dist/app ./client/dist/app

############################
# Stage 3: Runtime image
############################
FROM node:22-bookworm-slim

WORKDIR /app

# Copy server and built client from build stage
COPY --from=server-build /app/server ./server
COPY --from=server-build /app/client ./client

# Ensure DB directory exists (will be backed by volume on Synology)
RUN mkdir -p /app/server/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

WORKDIR /app/server
CMD ["npm", "start"]
