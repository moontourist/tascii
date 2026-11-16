# The tascii home server. The list lives in /data: mount a volume there so it survives updates.
#   docker build -t tascii .
#   docker run -d --name tascii --restart unless-stopped -p 8080:8080 -v tascii-data:/data -e TASCII_PASSWORD=... tascii
FROM node:22-alpine
WORKDIR /app
COPY panel.html panel.css panel.js prefs.js ./
COPY icons ./icons
COPY server ./server
RUN mkdir /data && chown node /data
USER node
ENV PORT=8080 TASCII_DATA=/data/tascii.json
EXPOSE 8080
VOLUME /data
CMD ["node", "server/server.mjs"]
