FROM node:22-alpine
WORKDIR /app

RUN npm install dotenv
RUN npm install pino

COPY scripts/asterisk-cdr-webhook.js ./scripts/asterisk-cdr-webhook.js

CMD ["node", "scripts/asterisk-cdr-webhook.js"]
