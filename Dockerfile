FROM node:24-bookworm

RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv ffmpeg && \
    python3 -m pip install --break-system-packages -U yt-dlp bgutil-ytdlp-pot-provider && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server/server.js"]