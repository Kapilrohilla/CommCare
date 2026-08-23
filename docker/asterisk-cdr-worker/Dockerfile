FROM node:22-alpine
WORKDIR /app

RUN npm install dotenv

COPY scripts/asterisk-cdr-webhook.js ./scripts/asterisk-cdr-webhook.js

CMD ["node", "scripts/asterisk-cdr-webhook.js"]
