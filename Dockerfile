FROM node:24-bookworm

RUN apt-get update && \
    apt-get install -y python3 python3-pip python3-venv ffmpeg git && \
    python3 -m pip install --break-system-packages -U yt-dlp bgutil-ytdlp-pot-provider && \
    git clone --depth 1 --branch 2.0.0 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil-ytdlp-pot-provider && \
    cd /opt/bgutil-ytdlp-pot-provider/server && \
    npm ci && \
    npx tsc && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["sh", "-c", "node /opt/bgutil-ytdlp-pot-provider/server/build/main.js --host 127.0.0.1 & exec node server/server.js"]
