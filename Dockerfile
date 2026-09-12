FROM node:24-bookworm

RUN apt-get update && \
    apt-get install -y python3 python3-pip ffmpeg && \
    pip3 install --break-system-packages yt-dlp && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3000

CMD ["node", "server/server.js"]