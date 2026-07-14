# Chainguard's free tier only publishes rolling `latest`/`latest-dev` tags
# (no pinned major-version tags); `latest-dev` currently resolves to Node 26.
# ---- Stage 1: build the React client --------------------------------------
FROM cgr.dev/chainguard/node:latest-dev AS client-build
# Chainguard images default to nonroot; root is needed so COPY + npm install
# can write into the working directory.
USER root
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ---- Stage 2: server runtime ----------------------------------------------
FROM cgr.dev/chainguard/node:latest-dev AS server
USER root
WORKDIR /app/server

# gh CLI is used for: token fallback (gh auth token), repo enrichment
# (ENRICH_METADATA=true), and paginated fetches (PAGINATE_VIA_GH=true).
# github-cli is not in the Chainguard APK catalog and the Chainguard
# github-cli image requires auth; download the official glibc release binary.
ARG TARGETARCH
ARG GH_VERSION=2.91.0
RUN wget -qO /tmp/gh.tar.gz \
      "https://github.com/cli/cli/releases/download/v${GH_VERSION}/gh_${GH_VERSION}_linux_${TARGETARCH}.tar.gz" && \
    tar -xzf /tmp/gh.tar.gz -C /tmp && \
    mv /tmp/gh_${GH_VERSION}_linux_${TARGETARCH}/bin/gh /usr/local/bin/gh && \
    rm -rf /tmp/gh.tar.gz /tmp/gh_${GH_VERSION}_linux_${TARGETARCH}

# better-sqlite3 ships a prebuilt glibc binary for Node 26+, so no build
# tools (python3/make/gcc) are needed here — prebuild-install handles it.
COPY server/package*.json ./
RUN npm install --omit=dev
COPY server/ ./

# bundle the built client so the server can serve it on one port
COPY --from=client-build /app/client/dist ./public

ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data
EXPOSE 8787
VOLUME ["/data"]
# Chainguard node image sets ENTRYPOINT ["/usr/bin/node"]; only pass the script.
CMD ["index.js"]
